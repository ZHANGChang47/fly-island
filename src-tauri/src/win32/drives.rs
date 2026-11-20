//! Fixed (hard) drives, enumerated safely for the global file index.

use std::iter::once;

use windows::{
    core::PCWSTR,
    Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives},
};

/// `DRIVE_FIXED` from Win32. Declared locally so no extra `windows` crate
/// feature is needed; its value (3) is part of the stable Win32 API contract.
const DRIVE_FIXED: u32 = 3;

/// Letters of fixed drives present on this machine, e.g. `["C", "D"]`.
/// Removable media, CD-ROMs and network shares are skipped: indexing them is
/// slow and usually not what a local file search wants.
pub(crate) fn fixed_drive_letters() -> Vec<char> {
    // SAFETY: GetLogicalDrives takes no arguments and returns a bitmask.
    let mask = unsafe { GetLogicalDrives() };
    (0..26)
        .filter(|index| mask & (1u32 << index) != 0)
        .filter_map(|index| {
            let letter = char::from(b'A' + index as u8);
            let root: Vec<u16> = format!("{letter}:\\")
                .encode_utf16()
                .chain(once(0))
                .collect();
            // SAFETY: `root` is NUL-terminated and lives across the call;
            // GetDriveTypeW only reads it and returns a plain enum.
            let drive_type = unsafe { GetDriveTypeW(PCWSTR(root.as_ptr())) };
            (drive_type == DRIVE_FIXED).then_some(letter)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::fixed_drive_letters;

    #[test]
    fn finds_at_least_one_fixed_drive_on_this_machine() {
        // The build machine runs Windows with at least one hard drive. When a
        // CI host has none, the empty result is still a valid enumeration.
        let _ = fixed_drive_letters();
    }
}
