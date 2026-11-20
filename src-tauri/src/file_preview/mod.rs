//! Local file preview: reads a file into the dedicated preview window and exposes a
//! system-wide shortcut that previews the current selection in Explorer or on the desktop.
//!
//! Layout mirrors `file_search`: `model` holds pure classification, `hotkey` owns the
//! global shortcut, and commands live here as a thin layer.

mod hotkey;
mod model;

use std::collections::HashSet;
use std::io::Read;
use std::sync::Mutex;
use std::sync::OnceLock;

use base64::Engine;
use tauri::{AppHandle, Emitter, Manager};

/// Ask the preview window to render the file stored in `CURRENT`.
const OPEN_EVENT: &str = "file-preview-open";
/// Shortcut registration / read failures, shown in Settings.
const SHORTCUT_ERROR_EVENT: &str = "file-preview-shortcut-error";
/// No supported file in the current Explorer selection.
const NO_SELECTION_EVENT: &str = "file-preview-no-selection";

static CURRENT: OnceLock<Mutex<Option<model::PreviewFile>>> = OnceLock::new();
/// Paths explicitly chosen in the shell by the user; consumed once per preview.
static TRUSTED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn current() -> &'static Mutex<Option<model::PreviewFile>> {
    CURRENT.get_or_init(|| Mutex::new(None))
}

fn trusted() -> &'static Mutex<HashSet<String>> {
    TRUSTED.get_or_init(|| Mutex::new(HashSet::new()))
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let _ = current();
    hotkey::init(app);
    Ok(())
}

/// Reads a supported file into the current preview slot. Only paths in the search
/// index or explicitly selected in the shell are accepted, so a crafted IPC call
/// cannot turn this command into an arbitrary file reader.
fn load(path: &str) -> Result<model::PreviewFile, String> {
    let extension = model::extension_of(path);
    let kind = model::kind_for_extension(&extension)
        .ok_or_else(|| "该文件类型暂不支持预览。".to_string())?;
    let normalized = model::normalize_path(path);
    let approved = {
        let mut set = trusted().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        set.remove(&normalized)
    };
    if !approved && !crate::file_search::contains_normalized_path(&normalized) {
        return Err("该文件不在搜索索引中。".to_string());
    }
    let file = std::fs::File::open(path).map_err(|error| format!("无法打开文件：{error}"))?;
    let metadata = file.metadata().map_err(|error| format!("无法读取文件信息：{error}"))?;
    if !metadata.is_file() {
        return Err("只能预览文件。".to_string());
    }
    let mut reader = file;
    let mut buffer = Vec::with_capacity(metadata.len().min(model::PREVIEW_LIMIT) as usize);
    let truncated = metadata.len() > model::PREVIEW_LIMIT;
    reader
        .take(model::PREVIEW_LIMIT)
        .read_to_end(&mut buffer)
        .map_err(|error| format!("无法读取文件内容：{error}"))?;
    let payload = model::PreviewFile {
        path: path.to_string(),
        name: model::name_of(path),
        kind,
        data: base64::engine::general_purpose::STANDARD.encode(buffer),
        truncated,
    };
    let mut slot = current().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    *slot = Some(payload.clone());
    Ok(payload)
}

#[tauri::command]
pub async fn preview_file(path: String) -> Result<model::PreviewFile, String> {
    load(&path)
}

#[tauri::command]
pub async fn get_current_preview() -> Result<Option<model::PreviewFile>, String> {
    let slot = current().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    Ok(slot.clone())
}

/// Opens the file currently shown in the preview with its default system app.
#[tauri::command]
pub async fn open_preview_externally() -> Result<(), String> {
    let path = {
        let slot = current().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        slot.as_ref().map(|file| file.path.clone())
    };
    let path = path.ok_or_else(|| "当前没有预览文件。".to_string())?;
    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|error| format!("无法打开文件：{error}"))
}

/// Opens (or focuses) the preview window and asks it to render the current file.
#[tauri::command]
pub async fn open_file_preview(app: AppHandle) -> Result<(), String> {
    crate::preview_window::open(&app)?;
    if let Some(window) = app.get_webview_window(crate::preview_window::WINDOW_LABEL) {
        window.emit(OPEN_EVENT, ()).map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Opens the first previewable file of the current Explorer selection.
pub(crate) fn preview_selection(app: &AppHandle) {
    let paths = match crate::win32::shell_selection::foreground_selected_files() {
        Ok(paths) => paths,
        Err(error) => {
            let _ = app.emit(SHORTCUT_ERROR_EVENT, error);
            return;
        }
    };
    let target = paths.into_iter().find(|path| {
        model::kind_for_extension(&model::extension_of(path)).is_some()
    });
    let Some(path) = target else {
        let _ = app.emit(NO_SELECTION_EVENT, ());
        return;
    };
    {
        let mut set = trusted().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        set.insert(model::normalize_path(&path));
    }
    if let Err(error) = load(&path).and_then(|_| crate::preview_window::open(app)) {
        let _ = app.emit(SHORTCUT_ERROR_EVENT, error);
        return;
    }
    if let Some(window) = app.get_webview_window(crate::preview_window::WINDOW_LABEL) {
        let _ = window.emit(OPEN_EVENT, ());
    }
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::file_preview::preview_file,
            crate::file_preview::get_current_preview,
            crate::file_preview::open_file_preview,
            crate::file_preview::open_preview_externally,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
