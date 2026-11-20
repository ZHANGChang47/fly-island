//! Selected files in the foreground Explorer / desktop, read through Shell COM.
//!
//! `unsafe` is confined to this file: callers get owned paths and booleans.

use windows::{
    core::Interface,
    Win32::{
        Foundation::VARIANT_BOOL,
        System::{
            Com::{CoCreateInstance, CLSCTX_ALL, IDispatch},
            Variant::VARIANT,
        },
        UI::Shell::{
            IShellFolderViewDual, IShellWindows, ShellWindows, FolderItem, FolderItems,
            ShellWindowFindWindowOptions, ShellWindowTypeConstants,
        },
    },
};

use super::{com::ComApartment, window};

/// Up to this many selected items are returned; a bulk selection is not a preview target.
const MAX_SELECTION: usize = 8;

/// Paths of the files selected in the foreground shell view, or an empty vec when
/// the foreground window is not Explorer/the desktop or nothing is selected.
pub(crate) fn foreground_selected_files() -> Result<Vec<String>, String> {
    let foreground = window::foreground_window();
    if foreground.is_invalid() {
        return Ok(Vec::new());
    }
    // The hotkey may fire from a background thread; COM must be initialized there.
    let _apartment = ComApartment::multithreaded()
        .map_err(|error| format!("无法初始化 Shell 接口：{error}"))?;
    let shell: IShellWindows = unsafe {
        CoCreateInstance(&ShellWindows, None, CLSCTX_ALL)
            .map_err(|error| format!("无法连接资源管理器：{error}"))?
    };
    let mut document: Option<IDispatch> = None;
    let count = unsafe { shell.Count() }.unwrap_or(0);
    for index in 0..count.max(0) {
        let item = match unsafe { shell.Item(&variant_i32(index)) } {
            Ok(item) => item,
            Err(_) => continue,
        };
        let browser: IDispatch = item;
        if let Ok(web) = browser.cast::<windows::Win32::UI::Shell::IWebBrowser2>() {
            let hwnd = unsafe { web.HWND() }.unwrap_or_default();
            if hwnd.0 == foreground.0 as isize {
                document = unsafe { web.Document() }.ok();
                break;
            }
        }
    }
    // No Explorer window matched: fall back to the desktop view, which ShellWindows
    // does not enumerate on every Windows version.
    if document.is_none() && is_desktop(foreground) {
        let mut hwnd = 0i32;
        document = unsafe {
            shell
                .FindWindowSW(
                    std::ptr::null(),
                    std::ptr::null(),
                    ShellWindowTypeConstants(8),
                    &mut hwnd,
                    ShellWindowFindWindowOptions(1),
                )
                .ok()
        };
    }
    let Some(document) = document else {
        return Ok(Vec::new());
    };
    let view: IShellFolderViewDual = document
        .cast()
        .map_err(|error| format!("无法读取资源管理器选中项：{error}"))?;
    let items: FolderItems = unsafe { view.SelectedItems() }
        .map_err(|error| format!("无法读取选中项：{error}"))?;
    let total = unsafe { items.Count() }.unwrap_or(0).max(0) as usize;
    let mut paths = Vec::new();
    for index in 0..total.min(MAX_SELECTION) {
        let item: FolderItem = match unsafe { items.Item(&variant_i32(index as i32)) } {
            Ok(item) => item,
            Err(_) => continue,
        };
        let is_folder = unsafe { item.IsFolder() }
            .unwrap_or(VARIANT_BOOL(0))
            .as_bool();
        if is_folder {
            continue;
        }
        let path = unsafe { item.Path() }.unwrap_or_default().to_string();
        if !path.is_empty() && std::path::Path::new(&path).is_file() {
            paths.push(path);
        }
    }
    Ok(paths)
}

fn is_desktop(window_handle: windows::Win32::Foundation::HWND) -> bool {
    let class = window::class_name(window_handle);
    class == "Progman" || class == "WorkerW" || class == "SysListView32"
}

fn variant_i32(value: i32) -> VARIANT {
    // windows-core implements From<i32> as a VT_I4 VARIANT (same as UIA code uses).
    VARIANT::from(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::System::Variant::VT_I4;

    #[test]
    fn variant_holds_an_i4() {
        let value = variant_i32(3);
        // VARIANT_0 is a union wrapping a ManuallyDrop<VARIANT_0_0>, so both
        // levels need an explicit deref before reading the fields.
        let fields = unsafe { &value.Anonymous.Anonymous };
        assert_eq!(fields.vt, VT_I4);
        assert_eq!(unsafe { fields.Anonymous.lVal }, 3);
    }
}
