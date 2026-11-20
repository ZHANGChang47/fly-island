//! Pure file-kind classification and preview payload construction.

use serde::Serialize;

/// File categories the preview window can render.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PreviewKind {
    Pdf,
    Word,
    Excel,
    Slides,
    Markdown,
    Image,
}

/// Payload handed to the preview window. `data` is base64-encoded file bytes.
#[derive(Clone, Debug, Serialize)]
pub struct PreviewFile {
    pub path: String,
    pub name: String,
    pub kind: PreviewKind,
    pub data: String,
    pub truncated: bool,
}

/// Above this size the preview reads only the first chunk so the IPC call and
/// the renderer stay responsive; the user can still open the file externally.
pub const PREVIEW_LIMIT: u64 = 24 * 1024 * 1024;

/// Lower-case extension → renderable kind. Legacy binary Office formats (.doc,
/// .xls, .ppt) are deliberately absent: no pure front-end parser handles them.
pub fn kind_for_extension(extension: &str) -> Option<PreviewKind> {
    match extension.trim_start_matches('.').to_ascii_lowercase().as_str() {
        "pdf" => Some(PreviewKind::Pdf),
        "docx" => Some(PreviewKind::Word),
        "xlsx" | "xlsm" | "csv" | "tsv" => Some(PreviewKind::Excel),
        "pptx" => Some(PreviewKind::Slides),
        "md" | "markdown" | "mdx" => Some(PreviewKind::Markdown),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" => Some(PreviewKind::Image),
        _ => None,
    }
}

pub fn extension_of(path: &str) -> String {
    std::path::Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

pub fn name_of(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string()
}

pub fn normalize_path(path: &str) -> String {
    path.replace('/', "\\").to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_supported_extensions() {
        assert_eq!(kind_for_extension("PDF"), Some(PreviewKind::Pdf));
        assert_eq!(kind_for_extension(".Docx"), Some(PreviewKind::Word));
        assert_eq!(kind_for_extension("xlsx"), Some(PreviewKind::Excel));
        assert_eq!(kind_for_extension("pptx"), Some(PreviewKind::Slides));
        assert_eq!(kind_for_extension("MD"), Some(PreviewKind::Markdown));
        assert_eq!(kind_for_extension("JPG"), Some(PreviewKind::Image));
    }

    #[test]
    fn rejects_legacy_binary_office_and_unknown() {
        assert_eq!(kind_for_extension("doc"), None);
        assert_eq!(kind_for_extension("xls"), None);
        assert_eq!(kind_for_extension("ppt"), None);
        assert_eq!(kind_for_extension("exe"), None);
    }

    #[test]
    fn extracts_extension_and_name() {
        assert_eq!(extension_of(r"C:\Docs\Report.PDF"), "pdf");
        assert_eq!(name_of(r"C:\Docs\Report.PDF"), "Report.PDF");
        assert_eq!(normalize_path("C:/Docs/A.PDF"), r"c:\docs\a.pdf");
    }
}
