//! Directory skip rules for the indexer. Pure path logic with no Windows API
//! or I/O, so every rule is unit tested.

use std::path::Path;

/// System folders that are only worth skipping when they sit directly under a
/// volume root, e.g. `C:\Windows` or `C:\ProgramData`.
///
/// The location check matters: a user folder that merely shares one of these
/// names (for example `C:\Users\me\TuckPane\Windows`) must stay searchable,
/// otherwise ordinary files silently disappear from the index.
const ROOT_ONLY_SKIP: &[&str] = &[
    "Windows",
    "ProgramData",
    "Recovery",
    "$Recycle.Bin",
    "System Volume Information",
    "PerfLogs",
    "MSOCache",
    "$WinREAgent",
];

/// Build and dependency caches skipped at any depth: never worth searching and
/// they can hold hundreds of thousands of files.
const SKIP_ANYWHERE: &[&str] = &["node_modules", ".git", "$Windows.~WS", "$Windows.~BT"];

/// Whether a directory should not be walked.
pub fn should_skip_dir(path: &Path) -> bool {
    let Some(name) = path.file_name().map(|value| value.to_string_lossy()) else {
        return false;
    };
    if SKIP_ANYWHERE.iter().any(|skip| name.eq_ignore_ascii_case(skip)) {
        return true;
    }
    is_volume_root_child(path)
        && ROOT_ONLY_SKIP.iter().any(|skip| name.eq_ignore_ascii_case(skip))
}

/// True when `path` sits directly under a drive root, e.g. `C:\Windows`.
fn is_volume_root_child(path: &Path) -> bool {
    path.parent().is_some_and(|parent| parent.parent().is_none())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_system_folders_at_the_volume_root() {
        assert!(should_skip_dir(Path::new(r"C:\Windows")));
        assert!(should_skip_dir(Path::new(r"C:\ProgramData")));
        assert!(should_skip_dir(Path::new(r"D:\$Recycle.Bin")));
        assert!(should_skip_dir(Path::new(r"D:\System Volume Information")));
    }

    #[test]
    fn keeps_user_folders_that_share_a_system_folder_name() {
        // Regression: a user directory named `Windows` used to be skipped,
        // hiding every file inside it from search results.
        assert!(!should_skip_dir(Path::new(r"C:\Users\me\TuckPane\Windows")));
        assert!(!should_skip_dir(Path::new(r"C:\Work\ProgramData")));
        assert!(!should_skip_dir(Path::new(r"C:\Users\me\Recovery")));
    }

    #[test]
    fn skips_build_caches_at_any_depth() {
        assert!(should_skip_dir(Path::new(r"C:\Work\app\node_modules")));
        assert!(should_skip_dir(Path::new(r"C:\repo\.git")));
        assert!(!should_skip_dir(Path::new(r"C:\Work\notes")));
    }
}
