//! System-wide shortcut that opens the island's search page.

use crate::{
    clipboard_history::parse_shortcut_binding,
    win32::{self, message_window::{self, WindowMessages}},
};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::WM_HOTKEY,
};

/// Ctrl+Shift+G: G for "Go to file", free on Windows and away from the
/// clipboard (Ctrl+Shift+W) and translation (Ctrl+Shift+F) shortcuts.
const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+G";
const HOTKEY_ID: i32 = 0x4657;
const SHORTCUT_ERROR_EVENT: &str = "file-search-shortcut-error";

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn init(app: &AppHandle) {
    if APP.set(app.clone()).is_err() {
        return;
    }
    std::thread::spawn(run_hotkey_loop);
}

fn run_hotkey_loop() {
    let class_name = "FocuSDFileSearchHotkey";
    let instance = match message_window::module_instance() {
        Ok(value) => value,
        Err(error) => {
            report_error(Some(format!("无法初始化搜索快捷键：{error}")));
            return;
        }
    };
    if message_window::register_class::<SearchHotkeyWindow>(instance, class_name).is_err() {
        report_error(Some("无法注册搜索快捷键窗口。".to_string()));
        return;
    }
    let hwnd = match message_window::create_message_only_window(
        instance,
        class_name,
        "FocuSD File Search Hotkey",
    ) {
        Ok(value) => value,
        Err(error) => {
            report_error(Some(format!("无法创建搜索快捷键窗口：{error}")));
            return;
        }
    };
    if let Some(binding) = parse_shortcut_binding(DEFAULT_SHORTCUT) {
        let result = win32::hotkey::register(hwnd, HOTKEY_ID, binding.modifiers, binding.key_code)
            .map_err(|error| format!("快捷键 {} 已被占用或无法注册：{error}", binding.label));
        match result {
            Ok(()) => report_error(None),
            Err(error) => report_error(Some(error)),
        }
    }
    message_window::run_message_loop();
    let _ = win32::hotkey::unregister(hwnd, HOTKEY_ID);
}

fn report_error(error: Option<String>) {
    if let Some(app) = APP.get() {
        let _ = app.emit(SHORTCUT_ERROR_EVENT, error);
    }
}

struct SearchHotkeyWindow;

impl WindowMessages for SearchHotkeyWindow {
    fn handle(_: HWND, message: u32, wparam: WPARAM, _: LPARAM) -> Option<LRESULT> {
        if message == WM_HOTKEY && wparam.0 == HOTKEY_ID as usize {
            if let Some(app) = APP.get() {
                if let Err(error) = crate::file_search::open_island_search(app) {
                    eprintln!("failed to open file search: {error}");
                }
            }
            return Some(LRESULT(0));
        }
        None
    }
}
