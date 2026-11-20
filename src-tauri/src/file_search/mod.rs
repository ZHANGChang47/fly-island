//! Global file search: an Everything-style index of local fixed drives with a
//! dedicated window and a system-wide shortcut.
//!
//! Layout:
//! - `model`   — entry type, cache (de)serialization and pure query matching
//! - `skip`    — which directories the walker must not enter
//! - `indexer` — background filesystem walker
//! - `service` — global state, cache lifecycle and search entry point
//! - `hotkey`  — Ctrl+Shift+G registration
//! - commands live here as a thin layer over `service`

mod hotkey;
mod indexer;
mod model;
mod service;
mod skip;

use tauri::{AppHandle, Emitter, Manager};

/// Shared with `file_preview` so its IPC guard can accept indexed paths.
pub(crate) use service::contains_normalized_path;

const MAX_RESULTS: usize = 300;

/// Asks the island to switch to its search page; the frontend listens for it.
const ISLAND_OPEN_EVENT: &str = "file-search-open-island";

/// Shows the island and asks it to open the search page. The shortcut and the
/// tray both come through here so search opens in one place, like the
/// clipboard page does; the standalone window stays as a fallback for builds
/// whose island window is unavailable.
pub fn open_island_search(app: &AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(crate::island::WINDOW_LABEL) else {
        return crate::search_window::open(app);
    };
    window.show().map_err(|error| error.to_string())?;
    crate::island::focus::focus_island_for_shortcut(&window);
    window
        .emit(ISLAND_OPEN_EVENT, ())
        .map_err(|error| error.to_string())
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    service::init(app)?;
    hotkey::init(app);
    Ok(())
}

/// Runs a search against the in-memory index. Returns at most `MAX_RESULTS`.
#[tauri::command]
pub async fn search_files(query: String) -> Result<Vec<model::SearchEntry>, String> {
    Ok(service::search(&query, MAX_RESULTS))
}

/// Current index state, including progress while building.
#[tauri::command]
pub async fn get_file_search_status() -> Result<service::IndexStatus, String> {
    service::status()
}

/// Forces a fresh background scan of all fixed drives.
#[tauri::command]
pub async fn rebuild_file_search_index() -> Result<(), String> {
    service::rebuild();
    Ok(())
}

/// Opens a file or folder with its default handler. Only paths present in the
/// index are accepted, so a crafted path cannot launch arbitrary commands.
#[tauri::command]
pub async fn open_search_result(path: String) -> Result<(), String> {
    require_indexed(&path)?;
    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|error| format!("无法打开：{error}"))
}

/// Reveals a file in Explorer with it selected.
#[tauri::command]
pub async fn reveal_search_result(path: String) -> Result<(), String> {
    require_indexed(&path)?;
    tauri_plugin_opener::reveal_item_in_dir(&path)
        .map_err(|error| format!("无法在文件夹中显示：{error}"))
}

/// Copies the full path to the clipboard. Only indexed paths are copied.
#[tauri::command]
pub async fn copy_search_result_path(path: String) -> Result<(), String> {
    require_indexed(&path)?;
    arboard::Clipboard::new()
        .map_err(|error| format!("无法访问剪贴板：{error}"))?
        .set_text(&path)
        .map_err(|error| format!("无法复制路径：{error}"))
}

/// Guards the file commands: only a path currently in the index may be used.
/// Compares normalized paths so a different spelling of the same path still works.
fn require_indexed(path: &str) -> Result<(), String> {
    let target = path.replace('/', "\\").to_ascii_lowercase();
    if service::contains_normalized_path(&target) {
        Ok(())
    } else {
        Err("该文件不在搜索索引中。".to_string())
    }
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::file_search::search_files,
            crate::file_search::get_file_search_status,
            crate::file_search::rebuild_file_search_index,
            crate::file_search::open_search_result,
            crate::file_search::reveal_search_result,
            crate::file_search::copy_search_result_path,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::service::normalize_path;

    #[test]
    fn normalization_unifies_separators_and_case() {
        assert_eq!(normalize_path("C:/Work/A.TXT"), normalize_path("c:\\work\\a.txt"));
    }
}
