//! The global search window: created on demand, centred on the current screen.

use crate::settings_window::sizing::{self, Size};
use tauri::{
    AppHandle, Manager, Monitor, PhysicalPosition, WebviewWindowBuilder, WindowEvent,
};

const WINDOW_LABEL: &str = "search";

pub(crate) fn open(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.unminimize();
        return reveal(&window);
    }
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == WINDOW_LABEL)
        .cloned()
        .ok_or_else(|| "搜索窗口配置缺失。".to_string())?;
    let wanted = Size { width: config.width, height: config.height };
    let min = Size {
        width: config.min_width.unwrap_or(520.0),
        height: config.min_height.unwrap_or(400.0),
    };
    let screen = current_screen(app);
    let size = screen.as_ref().map_or(wanted, |screen| {
        let area = screen.work_area().size;
        sizing::fit(
            wanted,
            min,
            Size {
                width: f64::from(area.width) / screen.scale_factor(),
                height: f64::from(area.height) / screen.scale_factor(),
            },
        )
    });
    let mut config = config;
    config.width = size.width.max(min.width);
    config.height = size.height.max(min.height);
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?;
    if let Some(screen) = screen.as_ref() {
        let area = screen.work_area();
        let scale = screen.scale_factor();
        let x = area.position.x
            + ((f64::from(area.size.width) - size.width * scale) / 2.0).max(0.0) as i32;
        let y = area.position.y
            + ((f64::from(area.size.height) - size.height * scale) / 2.0).max(0.0) as i32;
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
    let hide_on_close = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            // Hide instead of destroy so the webview (and its focus) survive.
            api.prevent_close();
            let _ = hide_on_close.hide();
        }
    });
    reveal(&window)
}

fn current_screen(app: &AppHandle) -> Option<Monitor> {
    app.get_webview_window(crate::island::WINDOW_LABEL)
        .and_then(|window| window.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten())
}

fn reveal(window: &tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    crate::system::window_focus::focus_window(window)
}

#[tauri::command]
pub async fn open_search_window(app: AppHandle) -> Result<(), String> {
    open(&app)
}

#[tauri::command]
pub async fn close_search_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::search_window::open_search_window,
            crate::search_window::close_search_window,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
