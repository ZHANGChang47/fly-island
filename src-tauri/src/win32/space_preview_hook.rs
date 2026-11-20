//! Space-to-preview in Explorer / on the desktop, via a low-level keyboard hook.
//!
//! A bare Space must NOT be registered with `RegisterHotKey`: that would swallow
//! every Space typed anywhere in the system. Instead a `WH_KEYBOARD_LL` hook
//! inspects each key press and only consumes Space when the foreground window is
//! an Explorer view or the desktop. The slow part (Shell COM selection read +
//! preview) runs on the hook thread's message window, never in the hook callback
//! itself, which must stay fast to avoid Windows uninstalling a sluggish hook.

use std::{ptr, sync::OnceLock};

use windows::Win32::{
    Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, VK_CONTROL, VK_MENU, VK_SHIFT, VK_SPACE,
        },
        WindowsAndMessaging::{
            CallNextHookEx, HC_ACTION, HHOOK, KBDLLHOOKSTRUCT, LLKHF_ALTDOWN, PM_NOREMOVE,
            PeekMessageW, PostMessageW, SetWindowsHookExW, UnhookWindowsHookEx, WH_KEYBOARD_LL,
            WM_KEYDOWN, WM_KEYUP, WM_NULL,
        },
    },
};

use super::{message_window, window};

/// Message posted from the hook callback to the message window on the same thread.
const WM_SPACE_PREVIEW: u32 = 0x8000 + 21;

static APP: OnceLock<tauri::AppHandle> = OnceLock::new();

/// Class names of shell views where Space previews the selection. Kept narrow so
/// typing a Space in any other application is never intercepted.
const SHELL_CLASSES: [&str; 4] = ["CabinetWClass", "Progman", "WorkerW", "SysListView32"];

/// True when Space is already down, to ignore auto-repeat key downs.
struct SpaceState {
    down: bool,
}
thread_local! {
    static STATE: std::cell::RefCell<SpaceState> =
        const { std::cell::RefCell::new(SpaceState { down: false }) };
    /// The message window on this thread; the hook callback posts to it.
    static TARGET: std::cell::Cell<HWND> = const { std::cell::Cell::new(HWND(ptr::null_mut())) };
}

pub(crate) fn init(app: &tauri::AppHandle) -> bool {
    if APP.set(app.clone()).is_err() {
        return true;
    }
    match std::thread::Builder::new()
        .name("space-preview-hook".into())
        .spawn(run_hook_loop)
    {
        Ok(_) => true,
        Err(_) => false,
    }
}

fn run_hook_loop() {
    let Ok(module) = (unsafe { get_module() }) else {
        return;
    };
    // Create the thread's message queue before publishing the HWND; low-level
    // hooks call back on the installing thread.
    let mut message = Default::default();
    let _ = unsafe { PeekMessageW(&mut message, None, WM_NULL, WM_NULL, PM_NOREMOVE) };

    if message_window::register_class::<PreviewMessageWindow>(module, "FocuSDSpacePreviewHook")
        .is_err()
    {
        return;
    }
    let Ok(window_handle) = message_window::create_message_only_window(
        module,
        "FocuSDSpacePreviewHook",
        "FocuSD Space Preview",
    ) else {
        return;
    };
    TARGET.with(|cell| cell.set(window_handle));

    // SAFETY: this thread created a message queue above, and the callback lives
    // in this module for the whole program. WH_KEYBOARD_LL calls back on this thread.
    let installed = unsafe {
        SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), Some(module), 0)
    };
    let Ok(hook) = installed else {
        let _ = message_window::destroy_window(window_handle);
        return;
    };
    let _hook = InstalledHook(hook);

    message_window::run_message_loop();
    let _ = message_window::destroy_window(window_handle);
}

unsafe fn get_module() -> windows::core::Result<HINSTANCE> {
    message_window::module_instance()
}

struct InstalledHook(HHOOK);

impl Drop for InstalledHook {
    fn drop(&mut self) {
        // SAFETY: this guard is dropped on the thread that installed the hook.
        let _ = unsafe { UnhookWindowsHookEx(self.0) };
    }
}

/// Hook callback: must be fast. Only classifies the key and, for a shell view,
/// posts a message; all COM work happens in the window handler.
unsafe extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 && lparam.0 != 0 {
        let is_key_down = wparam.0 as u32 == WM_KEYDOWN;
        let is_key_up = wparam.0 as u32 == WM_KEYUP;
        if is_key_down || is_key_up {
            // SAFETY: for HC_ACTION Windows passes a live KBDLLHOOKSTRUCT for the callback.
            let key = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
            if key.vkCode == VK_SPACE.0 as u32 {
                let was_down = STATE.with(|cell| {
                    let mut state = cell.borrow_mut();
                    let previous = state.down;
                    state.down = is_key_down;
                    previous
                });
                // Only the first key-down of a press; ignore ALT+Space and repeats.
                if is_key_down && !was_down && !key.flags.contains(LLKHF_ALTDOWN) {
                    let foreground = window::foreground_window();
                    if !foreground.is_invalid() && is_shell_view(foreground) {
                        // SAFETY: no pointer is passed; the target window lives on this thread.
                        let target = TARGET.with(|cell| cell.get());
                        let _ = unsafe {
                            PostMessageW(Some(target), WM_SPACE_PREVIEW, WPARAM(0), LPARAM(0))
                        };
                        return LRESULT(1);
                    }
                }
                // Let the key-up through even when we consumed the down, so the
                // OS and other hooks keep a consistent key state.
                if is_key_up {
                    return unsafe { CallNextHookEx(None, code, wparam, lparam) };
                }
            }
        }
    }
    // SAFETY: forwards the original arguments unchanged.
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

fn is_shell_view(handle: HWND) -> bool {
    let class = window::class_name(handle);
    SHELL_CLASSES.contains(&class.as_str())
}

struct PreviewMessageWindow;

impl message_window::WindowMessages for PreviewMessageWindow {
    fn handle(_: HWND, message: u32, _: WPARAM, _: LPARAM) -> Option<LRESULT> {
        if message == WM_SPACE_PREVIEW {
            if let Some(app) = APP.get() {
                // Ignore the event while a modifier is held: Ctrl/Shift+Space are
                // common IME and selection shortcuts and must keep working.
                if !modifier_held() {
                    crate::file_preview::preview_selection(app);
                }
            }
            return Some(LRESULT(0));
        }
        None
    }
}

fn modifier_held() -> bool {
    // SAFETY: GetAsyncKeyState only takes virtual-key values and has no pointers.
    unsafe {
        (GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_SHIFT.0 as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000) != 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_classes_cover_explorer_and_desktop() {
        assert!(SHELL_CLASSES.contains(&"CabinetWClass"));
        assert!(SHELL_CLASSES.contains(&"Progman"));
        assert!(SHELL_CLASSES.contains(&"WorkerW"));
    }

    #[test]
    fn shell_classes_do_not_include_text_editors() {
        assert!(!SHELL_CLASSES.contains(&"Notepad"));
        assert!(!SHELL_CLASSES.contains(&"Chrome_WidgetWin_1"));
    }

    #[test]
    fn space_key_code_is_32() {
        assert_eq!(VK_SPACE.0, 0x20);
    }
}
