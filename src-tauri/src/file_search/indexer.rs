//! Background filesystem walker that builds the in-memory search index.
//! Runs off the IPC thread, fans the walk out over worker threads, and can be
//! stopped between directories.

use super::{model::SearchEntry, skip::should_skip_dir};
use crate::win32;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc,
    },
    thread,
};

/// Runs a full scan of the fixed drives. `stop` lets the caller cancel between
/// directories; results are returned in one batch at the end.
pub fn build_index(stop: &AtomicBool, progress: Option<&AtomicU64>) -> Vec<SearchEntry> {
    let mut entries = Vec::new();
    for letter in win32::drives::fixed_drive_letters() {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let root = PathBuf::from(format!("{letter}:\\"));
        scan_root(&root, stop, progress, &mut entries);
    }
    entries
}

/// Indexes one volume. The root level is read inline, then one more level of
/// subdirectories is expanded into the work queue, so parallel workers start
/// with balanced slices instead of one huge branch on a single thread.
fn scan_root(
    root: &Path,
    stop: &AtomicBool,
    progress: Option<&AtomicU64>,
    out: &mut Vec<SearchEntry>,
) {
    let mut work = Vec::new();
    for dir in read_level(root, stop, progress, out) {
        if stop.load(Ordering::SeqCst) {
            return;
        }
        let mut children = read_level(&dir, stop, progress, out);
        if children.is_empty() {
            work.push(dir);
        } else {
            work.append(&mut children);
        }
    }
    if work.is_empty() || stop.load(Ordering::SeqCst) {
        return;
    }
    run_workers(work, stop, progress, out);
}

/// Walks the work queue with one thread per available core. Work is handed out
/// through an atomic cursor so a slow branch does not stall the others.
fn run_workers(
    work: Vec<PathBuf>,
    stop: &AtomicBool,
    progress: Option<&AtomicU64>,
    out: &mut Vec<SearchEntry>,
) {
    let work = Arc::new(work);
    let next = Arc::new(AtomicU64::new(0));
    let workers = thread::available_parallelism()
        .map_or(4, std::num::NonZeroUsize::get)
        .min(work.len())
        .max(1);
    let (tx, rx) = mpsc::channel::<Vec<SearchEntry>>();
    thread::scope(|scope| {
        for _ in 0..workers {
            let work = Arc::clone(&work);
            let next = Arc::clone(&next);
            let tx = tx.clone();
            scope.spawn(move || {
                let mut local = Vec::new();
                loop {
                    if stop.load(Ordering::SeqCst) {
                        break;
                    }
                    let index = next.fetch_add(1, Ordering::Relaxed) as usize;
                    let Some(dir) = work.get(index) else {
                        break;
                    };
                    walk(dir, stop, progress, &mut local);
                }
                let _ = tx.send(local);
            });
        }
        drop(tx);
        for chunk in rx.iter() {
            out.extend(chunk);
        }
    });
}

/// Reads one directory level: appends every entry to `out` and returns the
/// subdirectories that still need walking.
fn read_level(
    dir: &Path,
    stop: &AtomicBool,
    progress: Option<&AtomicU64>,
    out: &mut Vec<SearchEntry>,
) -> Vec<PathBuf> {
    let mut children = Vec::new();
    let read_dir = match fs::read_dir(dir) {
        Ok(handle) => handle,
        Err(_) => return children,
    };
    for item in read_dir.flatten() {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let path = item.path();
        // `symlink_metadata` avoids following junctions/symlinks, which both
        // loop forever and pull in volumes we skipped.
        let metadata = match fs::symlink_metadata(&path) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let file_type = metadata.file_type();
        if file_type.is_symlink() {
            continue;
        }
        let is_dir = file_type.is_dir();
        if is_dir && should_skip_dir(&path) {
            continue;
        }
        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or_default();
        let size = if is_dir { 0 } else { metadata.len() };
        if let Some(entry) =
            SearchEntry::new(path.to_string_lossy().into_owned(), size, is_dir, modified)
        {
            out.push(entry);
            if let Some(counter) = progress {
                counter.fetch_add(1, Ordering::Relaxed);
            }
        }
        if is_dir {
            children.push(path);
        }
    }
    children
}

/// Depth-first walk of one subtree.
fn walk(dir: &Path, stop: &AtomicBool, progress: Option<&AtomicU64>, out: &mut Vec<SearchEntry>) {
    for child in read_level(dir, stop, progress, out) {
        if stop.load(Ordering::SeqCst) {
            return;
        }
        walk(&child, stop, progress, out);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Builds a throwaway tree: a user folder that happens to be named
    /// `Windows` (the case that used to lose files) next to a `node_modules`
    /// cache that must still be skipped.
    fn temp_tree(label: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("fsindex-{label}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("TuckPane").join("Windows").join("插件")).unwrap();
        fs::write(
            root.join("TuckPane").join("Windows").join("插件").join("已安装插件清单.md"),
            b"# list",
        )
        .unwrap();
        fs::create_dir_all(root.join("app").join("node_modules").join("pkg")).unwrap();
        fs::write(root.join("app").join("node_modules").join("pkg").join("index.js"), b"x").unwrap();
        fs::write(root.join("app").join("main.rs"), b"fn main() {}").unwrap();
        root
    }

    #[test]
    fn finds_files_below_a_user_folder_named_windows() {
        let root = temp_tree("nested");
        let stop = AtomicBool::new(false);
        let mut entries = Vec::new();
        scan_root(&root, &stop, None, &mut entries);
        let paths: Vec<String> = entries.iter().map(|entry| entry.path().to_string()).collect();
        assert!(
            paths.iter().any(|path| path.ends_with("已安装插件清单.md")),
            "nested markdown file missing from index: {paths:?}"
        );
        assert!(paths.iter().any(|path| path.ends_with("main.rs")));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn skips_build_caches_at_any_depth() {
        let root = temp_tree("skip");
        let stop = AtomicBool::new(false);
        let mut entries = Vec::new();
        scan_root(&root, &stop, None, &mut entries);
        let paths: Vec<String> = entries.iter().map(|entry| entry.path().to_string()).collect();
        assert!(paths.iter().all(|path| !path.contains("node_modules")), "{paths:?}");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn a_stopped_scan_visits_nothing() {
        let root = temp_tree("stopped");
        let stop = AtomicBool::new(true);
        let mut entries = Vec::new();
        scan_root(&root, &stop, None, &mut entries);
        assert!(entries.is_empty());
        let _ = fs::remove_dir_all(&root);
    }
}
