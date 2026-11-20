//! Global search state: in-memory index, on-disk cache and background builds.

use super::{indexer, model};
use crate::win32;
use tauri::Manager;
use std::{
    fs,
    io::{BufReader, BufWriter, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc, Mutex, MutexGuard, OnceLock, PoisonError,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

/// Emitted whenever the index state changes; the search window shows it.
const INDEX_STATUS_EVENT: &str = "file-search-index-status";

/// Snapshot of index health, mirrored in the frontend api.ts.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    /// Entries currently searchable.
    pub entry_count: usize,
    /// True while a background build is running.
    pub building: bool,
    /// Entries visited by the current build, for a progress readout.
    pub scanned: u64,
    /// Human-readable roots being indexed.
    pub roots: Vec<String>,
    /// When the last successful build finished (unix millis), if any.
    pub built_at: Option<i64>,
}

struct State {
    entries: Vec<model::SearchEntry>,
    building: bool,
    scanned: u64,
    roots: Vec<String>,
    built_at: Option<i64>,
    app: Option<AppHandle>,
    cache_path: PathBuf,
    stop: Option<Arc<AtomicBool>>,
}

static STATE: OnceLock<Mutex<State>> = OnceLock::new();

fn state() -> Result<&'static Mutex<State>, String> {
    STATE.get().ok_or_else(|| "文件搜索尚未初始化。".to_string())
}

fn lock(state: &'static Mutex<State>) -> MutexGuard<'static, State> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn fixed_roots() -> Vec<String> {
    win32::drives::fixed_drive_letters()
        .into_iter()
        .map(|letter| format!("{letter}:\\"))
        .collect()
}

/// Initializes the service: loads a valid cache for instant startup, then
/// kicks off a background rebuild so results stay current.
pub fn init(app: &AppHandle) -> Result<(), String> {
    let cache_path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法解析应用数据目录：{error}"))?
        .join("file-search-index.json");
    let roots = fixed_roots();
    let mut entries = Vec::new();
    let mut built_at = None;
    if let Ok(file) = fs::File::open(&cache_path) {
        if let Some(cached) = model::read_index(BufReader::new(file), &roots) {
            entries = cached;
            built_at = Some(now_millis());
        }
    }
    let _ = STATE.set(Mutex::new(State {
        entries,
        building: false,
        scanned: 0,
        roots,
        built_at,
        app: Some(app.clone()),
        cache_path,
        stop: None,
    }));
    rebuild();
    Ok(())
}

fn status_snapshot(state: &State) -> IndexStatus {
    IndexStatus {
        entry_count: state.entries.len(),
        building: state.building,
        scanned: state.scanned,
        roots: state.roots.clone(),
        built_at: state.built_at,
    }
}

fn emit_status(shared: &'static Mutex<State>) {
    let (app, snapshot) = {
        let handle = lock(shared);
        (handle.app.clone(), status_snapshot(&handle))
    };
    if let Some(app) = app {
        let _ = app.emit(INDEX_STATUS_EVENT, snapshot);
    }
}

pub fn status() -> Result<IndexStatus, String> {
    let shared = state()?;
    Ok(status_snapshot(&lock(shared)))
}

/// Starts a background rebuild, cancelling any in-progress one first.
pub fn rebuild() {
    let Ok(shared) = state() else {
        return;
    };
    let stop = Arc::new(AtomicBool::new(false));
    {
        let mut handle = lock(shared);
        if let Some(previous) = handle.stop.take() {
            previous.store(true, Ordering::SeqCst);
        }
        handle.building = true;
        handle.scanned = 0;
        handle.stop = Some(Arc::clone(&stop));
    }
    thread::spawn(move || run_build(shared, stop));
    emit_status(shared);
}

/// The walker increments `counter` per entry; this loop publishes progress a
/// few times a second instead of emitting one event per file.
fn run_build(shared: &'static Mutex<State>, stop: Arc<AtomicBool>) {
    let counter = Arc::new(AtomicU64::new(0));
    let (done_tx, done_rx) = mpsc::channel();
    let build_stop = Arc::clone(&stop);
    let build_counter = Arc::clone(&counter);
    let builder = thread::spawn(move || {
        let result = indexer::build_index(&build_stop, Some(&build_counter));
        let _ = done_tx.send(result);
    });
    loop {
        match done_rx.recv_timeout(Duration::from_millis(250)) {
            Ok(entries) => {
                finish_build(shared, &stop, entries, counter.load(Ordering::Relaxed), false);
                break;
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let scanned = counter.load(Ordering::Relaxed);
                // Only publish progress if this build is still the current one.
                if is_current(shared, &stop) {
                    lock(shared).scanned = scanned;
                    emit_status(shared);
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                finish_build(shared, &stop, Vec::new(), counter.load(Ordering::Relaxed), true);
                break;
            }
        }
    }
    let _ = builder.join();
}

/// Whether `stop` is still the build recorded in state. A superseded build must
/// not publish results or progress over the newer one.
fn is_current(shared: &'static Mutex<State>, stop: &Arc<AtomicBool>) -> bool {
    lock(shared)
        .stop
        .as_ref()
        .is_some_and(|current| Arc::ptr_eq(current, stop))
}

fn finish_build(
    shared: &'static Mutex<State>,
    stop: &Arc<AtomicBool>,
    entries: Vec<model::SearchEntry>,
    scanned: u64,
    failed: bool,
) {
    let current = is_current(shared, stop);
    let cancelled = stop.load(Ordering::SeqCst);
    let usable = current && !cancelled && !failed;
    let (roots, cache_path) = {
        let handle = lock(shared);
        (handle.roots.clone(), handle.cache_path.clone())
    };
    if usable {
        write_cache(&cache_path, &entries, &roots);
    }
    {
        let mut handle = lock(shared);
        if current {
            handle.building = false;
            handle.scanned = scanned;
            if usable {
                handle.entries = entries;
                handle.built_at = Some(now_millis());
            }
            handle.stop = None;
        }
    }
    if current {
        emit_status(shared);
    }
}

/// Streams the index into a sibling temp file and renames it into place: an
/// interrupted write never leaves a half-written cache behind, and the JSON is
/// never held as one string in memory.
fn write_cache(path: &Path, entries: &[model::SearchEntry], roots: &[String]) {
    let Some(parent) = path.parent() else {
        return;
    };
    let _ = fs::create_dir_all(parent);
    let temp = path.with_extension("json.tmp");
    let written = fs::File::create(&temp).and_then(|file| {
        let mut writer = BufWriter::new(file);
        model::write_index(entries, roots, &mut writer).map_err(std::io::Error::other)?;
        writer.flush()
    });
    if written.is_ok() {
        let _ = fs::rename(&temp, path);
    }
}

pub fn search(query: &str, limit: usize) -> Vec<model::SearchEntry> {
    let Ok(shared) = state() else {
        return Vec::new();
    };
    let handle = lock(shared);
    model::search(&handle.entries, query, limit)
}

/// Whether `path` (already normalized) is in the index. Used to guard the file
/// commands without cloning the whole entry list on every call.
pub fn contains_normalized_path(path: &str) -> bool {
    let Ok(shared) = state() else {
        return false;
    };
    lock(shared)
        .entries
        .iter()
        .any(|entry| normalize_path(entry.path()) == path)
}

pub(super) fn normalize_path(path: &str) -> String {
    path.replace('/', "\\").to_ascii_lowercase()
}
