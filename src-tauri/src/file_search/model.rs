//! Data model and pure query logic for the global file search.
//! No I/O and no Windows API here, so every rule can be unit tested.

use serde::ser::{Serialize, SerializeStruct, Serializer};
use serde::{Deserialize, Serialize as DeriveSerialize};

/// One indexed filesystem entry, kept small: 1.6M entries must fit in memory.
///
/// Only the path itself is stored; the lowercase name used for matching is
/// derived on the fly (an ASCII-case-insensitive byte compare allocates
/// nothing), because a precomputed lowercase copy per entry cost a second
/// heap allocation for every one of 1.6M paths.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchEntry {
    /// Full path with Windows separators, e.g. `C:\Users\me\note.txt`.
    path: Box<str>,
    /// Byte offset where the file name starts inside `path`.
    name_start: u32,
    /// Byte offset of the extension inside the name, or `NO_EXT`.
    ext_start: u32,
    size: u64,
    is_dir: bool,
    modified: i64,
}

/// Marker for "this name has no extension".
const NO_EXT: u32 = u32::MAX;

/// ASCII-case-insensitive `haystack.contains(needle)`; `needle` must already
/// be ASCII-lowercased. Non-ASCII bytes compare as themselves, which is what
/// makes Chinese file names match verbatim.
fn contains_ci(haystack: &str, needle_lower: &str) -> bool {
    let (h, n) = (haystack.as_bytes(), needle_lower.as_bytes());
    if n.is_empty() {
        return true;
    }
    if n.len() > h.len() {
        return false;
    }
    for start in 0..=h.len() - n.len() {
        if h[start..start + n.len()]
            .iter()
            .zip(n)
            .all(|(a, b)| a.to_ascii_lowercase() == *b)
        {
            return true;
        }
    }
    false
}

/// ASCII-case-insensitive prefix test; `prefix_lower` must be lowercased.
fn starts_with_ci(haystack: &str, prefix_lower: &str) -> bool {
    let (h, p) = (haystack.as_bytes(), prefix_lower.as_bytes());
    h.len() >= p.len()
        && h[..p.len()]
            .iter()
            .zip(p)
            .all(|(a, b)| a.to_ascii_lowercase() == *b)
}

/// ASCII-case-insensitive equality; `other_lower` must be lowercased.
fn eq_ci(value: &str, other_lower: &str) -> bool {
    value.len() == other_lower.len() && starts_with_ci(value, other_lower)
}

/// Byte-wise ASCII-case-insensitive ordering, used to rank equal scores.
fn cmp_ci(a: &str, b: &str) -> std::cmp::Ordering {
    a.as_bytes()
        .iter()
        .map(|byte| byte.to_ascii_lowercase())
        .cmp(b.as_bytes().iter().map(|byte| byte.to_ascii_lowercase()))
}

impl SearchEntry {
    /// Builds an entry from a path and its metadata. `None` for paths without a
    /// file name.
    pub fn new(path: String, size: u64, is_dir: bool, modified: i64) -> Option<Self> {
        let file_name = std::path::Path::new(&path).file_name()?;
        let name = file_name.to_string_lossy();
        // `file_name` is always a suffix of the path, so its length gives the
        // start offset without another allocation.
        let name_start = path.len().checked_sub(name.len())?;
        let ext_start = match name.rfind('.') {
            // A leading dot is a dotfile (`.gitignore`), not an extension.
            Some(index) if index > 0 => name_start as u32 + index as u32 + 1,
            _ => NO_EXT,
        };
        Some(Self {
            path: path.into_boxed_str(),
            name_start: name_start as u32,
            ext_start,
            size,
            is_dir,
            modified,
        })
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    /// File or folder name including the extension.
    fn name(&self) -> &str {
        &self.path[self.name_start as usize..]
    }

    /// Everything before the file name, including the trailing separator.
    fn parent_path(&self) -> &str {
        &self.path[..self.name_start as usize]
    }

    /// Lowercased name, matched case-insensitively.
    fn name_lower(&self) -> String {
        self.name().to_ascii_lowercase()
    }

    /// Lowercased parent folder, used by `path:` filters.
    fn parent_lower(&self) -> String {
        let end = (self.name_start as usize).saturating_sub(1);
        self.path[..end].to_ascii_lowercase()
    }

    /// Lowercased extension without the dot; empty for folders and dotfiles.
    fn ext(&self) -> &str {
        match self.ext_start {
            NO_EXT => "",
            start => &self.path[start as usize..],
        }
    }

    /// Whether the extension equals `value`, ignoring case and without allocating.
    fn ext_eq(&self, value: &str) -> bool {
        match self.ext_start {
            NO_EXT => value.is_empty(),
            start => self.path[start as usize..].eq_ignore_ascii_case(value),
        }
    }
}

/// Hand-written so the JSON keeps the shape the frontend mirrors
/// (`window.search.api.ts`): name and lowercase views are emitted on the fly
/// (only for the handful of results sent over IPC, never for the whole index).
impl Serialize for SearchEntry {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("SearchEntry", 8)?;
        state.serialize_field("path", &self.path)?;
        state.serialize_field("name", self.name())?;
        state.serialize_field("nameLower", &self.name_lower())?;
        state.serialize_field("parentLower", &self.parent_lower())?;
        state.serialize_field("ext", &self.ext().to_ascii_lowercase())?;
        state.serialize_field("size", &self.size)?;
        state.serialize_field("isDir", &self.is_dir)?;
        state.serialize_field("modified", &self.modified)?;
        state.end()
    }
}

#[derive(Debug, Clone, DeriveSerialize, Deserialize)]
struct StoredEntry {
    path: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    is_dir: bool,
    #[serde(default)]
    modified: i64,
}

/// On-disk index format. Version bumps invalidate old caches.
#[derive(Debug, DeriveSerialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredIndex {
    version: u32,
    /// Root folders the index was built from; a mismatch forces a rebuild.
    roots: Vec<String>,
    entries: Vec<StoredEntry>,
}

/// The form written to disk: borrows the entries instead of cloning every path,
/// which keeps a 1.6M-entry write from doubling memory.
#[derive(DeriveSerialize)]
#[serde(rename_all = "camelCase")]
struct StoredIndexRef<'a> {
    version: u32,
    roots: &'a [String],
    entries: Vec<StoredEntryRef<'a>>,
}

#[derive(DeriveSerialize)]
#[serde(rename_all = "camelCase")]
struct StoredEntryRef<'a> {
    path: &'a str,
    size: u64,
    is_dir: bool,
    modified: i64,
}

pub const INDEX_VERSION: u32 = 1;

/// Streams the index to `writer`; used with a buffered file so a large index
/// never has a full JSON copy in memory.
pub fn write_index<W: std::io::Write>(
    entries: &[SearchEntry],
    roots: &[String],
    writer: W,
) -> Result<(), String> {
    let stored = StoredIndexRef {
        version: INDEX_VERSION,
        roots,
        entries: entries
            .iter()
            .map(|entry| StoredEntryRef {
                path: entry.path(),
                size: entry.size,
                is_dir: entry.is_dir,
                modified: entry.modified,
            })
            .collect(),
    };
    serde_json::to_writer(writer, &stored).map_err(|error| error.to_string())
}

/// Reads a cached index from `reader`. Returns `None` for a missing, corrupt,
/// outdated or root-mismatched cache so callers rebuild instead of trusting
/// stale data.
pub fn read_index<R: std::io::Read>(
    reader: R,
    current_roots: &[String],
) -> Option<Vec<SearchEntry>> {
    let stored: StoredIndex = serde_json::from_reader(reader).ok()?;
    if stored.version != INDEX_VERSION {
        return None;
    }
    let mut cached_roots = stored.roots;
    cached_roots.sort_unstable();
    let mut roots = current_roots.to_vec();
    roots.sort_unstable();
    if cached_roots != roots {
        return None;
    }
    let entries = stored
        .entries
        .into_iter()
        .filter_map(|item| {
            SearchEntry::new(item.path, item.size, item.is_dir, item.modified)
        })
        .collect();
    Some(entries)
}

/// A single parsed filter token from the search box.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Term {
    /// A plain word: matches the lowercased name as a substring.
    Name(String),
    /// `ext:rs`: matches the extension exactly.
    Ext(String),
    /// `path:work`: matches the lowercased parent path as a substring.
    Path(String),
}

/// Parses a query into AND-ed terms. Supports multiple extensions in one
/// `ext:` token separated by commas (`ext:rs,toml`). Unknown prefixes are
/// treated as plain name words.
fn parse_query(query: &str) -> Vec<Term> {
    query
        .split_whitespace()
        .map(|token| {
            let (prefix, rest) = match token.split_once(':') {
                Some((prefix, rest)) => (prefix.to_ascii_lowercase(), rest),
                None => return Term::Name(token.to_ascii_lowercase()),
            };
            let rest = rest.trim().to_ascii_lowercase();
            match prefix.as_str() {
                "ext" => {
                    let exts: Vec<String> = rest
                        .split(',')
                        .map(|value| value.trim_start_matches('.').to_string())
                        .filter(|value| !value.is_empty())
                        .collect();
                    if exts.is_empty() {
                        Term::Name(token.to_ascii_lowercase())
                    } else {
                        // Represent "any of these extensions" as repeated Name-style
                        // checks handled in `matches`.
                        Term::Ext(exts.join(","))
                    }
                }
                "path" => {
                    if rest.is_empty() {
                        Term::Name(token.to_ascii_lowercase())
                    } else {
                        Term::Path(rest)
                    }
                }
                _ => Term::Name(token.to_ascii_lowercase()),
            }
        })
        .collect()
}

fn matches(entry: &SearchEntry, terms: &[Term]) -> bool {
    terms.iter().all(|term| match term {
        Term::Name(word) => contains_ci(entry.name(), word),
        Term::Path(word) => contains_ci(entry.parent_path(), word),
        Term::Ext(values) => values.split(',').any(|ext| entry.ext_eq(ext)),
    })
}

/// Relevance score: smaller is better. Exact name and prefix matches rank
/// above mid-name matches; files rank above folders on a tie.
fn score(entry: &SearchEntry, query_lower: &str) -> u64 {
    let name = entry.name();
    let mut value = if eq_ci(name, query_lower) {
        0
    } else if starts_with_ci(name, query_lower) {
        10
    } else if contains_ci(name, query_lower) {
        30
    } else {
        // A hit that only matched a filter (e.g. `path:`) did not match the name.
        60
    };
    if entry.is_dir {
        value += 5;
    }
    // Shorter paths are usually more relevant; cap so this never dominates.
    value + (entry.path.len() as u64).min(200)
}

/// Searches the in-memory index. Empty queries return nothing (typing prompt),
/// everything else matches all terms with AND and sorts by relevance then name.
pub fn search(entries: &[SearchEntry], query: &str, limit: usize) -> Vec<SearchEntry> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let terms = parse_query(trimmed);
    let query_lower = trimmed.to_ascii_lowercase();
    let mut hits: Vec<(u64, &SearchEntry)> = entries
        .iter()
        .filter(|entry| matches(entry, &terms))
        .map(|entry| (score(entry, &query_lower), entry))
        .collect();
    hits.sort_by(|(score_a, entry_a), (score_b, entry_b)| {
        score_a
            .cmp(score_b)
            .then_with(|| cmp_ci(entry_a.name(), entry_b.name()))
            .then_with(|| entry_a.path.cmp(&entry_b.path))
    });
    hits.into_iter().take(limit).map(|(_, entry)| entry.clone()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(path: &str) -> SearchEntry {
        SearchEntry::new(path.to_string(), 0, false, 0).expect("valid absolute path")
    }

    #[test]
    fn derives_name_and_extension_from_the_path() {
        let item = entry(r"C:\Work\Report.TXT");
        assert_eq!(item.name(), "Report.TXT");
        assert_eq!(item.name_lower(), "report.txt");
        assert_eq!(item.ext(), "TXT");
        assert!(item.parent_lower().contains("work"));
        assert!(item.ext_eq("txt"));
    }

    #[test]
    fn dotfiles_have_no_extension() {
        let item = entry(r"C:\Work\.gitignore");
        assert_eq!(item.ext(), "");
        assert!(!item.ext_eq("gitignore"));
        let nested = entry(r"C:\Work\archive.tar.gz");
        assert_eq!(nested.ext(), "gz");
    }

    #[test]
    fn serializes_the_shape_the_frontend_mirrors() {
        let item = entry(r"C:\Work\Report.TXT");
        let json = serde_json::to_string(&item).expect("serialize");
        assert!(json.contains(r#""name":"Report.TXT""#), "{json}");
        assert!(json.contains(r#""nameLower":"report.txt""#), "{json}");
        assert!(json.contains(r#""parentLower":"c:\\work""#), "{json}");
        assert!(json.contains(r#""ext":"txt""#), "{json}");
    }

    #[test]
    fn cache_round_trips_and_rejects_root_mismatch() {
        let roots = vec![r"C:\".to_string()];
        let entries = vec![entry(r"C:\Work\a.txt"), entry(r"C:\Work\笔记.md")];
        let mut buffer = Vec::new();
        write_index(&entries, &roots, &mut buffer).expect("serialize");
        let loaded = read_index(&buffer[..], &roots).expect("load");
        assert_eq!(loaded, entries);
        assert!(read_index(&buffer[..], &[r"D:\".to_string()]).is_none());
        assert!(read_index(&b"not json"[..], &roots).is_none());
    }

    #[test]
    fn plain_words_match_name_case_insensitively() {
        let entries = vec![
            entry(r"C:\Work\Report.TXT"),
            entry(r"C:\Work\notes.md"),
            entry(r"C:\Other\report.pdf"),
        ];
        let hits = search(&entries, "REPORT", 50);
        assert_eq!(hits.len(), 2);
        assert!(hits.iter().all(|hit| hit.name_lower().contains("report")));
    }

    #[test]
    fn multiple_words_are_anded() {
        let entries = vec![
            entry(r"C:\Work\2026 report.txt"),
            entry(r"C:\Work\2025 report.txt"),
        ];
        let hits = search(&entries, "report 2026", 50);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].name(), "2026 report.txt");
    }

    #[test]
    fn ext_and_path_filters_apply() {
        let entries = vec![
            entry(r"C:\Work\a.rs"),
            entry(r"C:\Work\b.txt"),
            entry(r"C:\Home\c.rs"),
        ];
        let hits = search(&entries, "ext:rs path:work", 50);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].name(), "a.rs");
        let multi = search(&entries, "ext:rs,txt", 50);
        assert_eq!(multi.len(), 3);
    }

    #[test]
    fn chinese_names_match_as_substrings() {
        let entries = vec![
            entry(r"C:\Users\me\TuckPane\Windows\收纳窗\已安装插件清单.md"),
            entry(r"C:\Work\other.md"),
        ];
        let hits = search(&entries, "已安装插件清单", 50);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].name(), "已安装插件清单.md");
    }

    #[test]
    fn empty_query_returns_nothing_and_limit_is_honoured() {
        let entries = vec![entry(r"C:\a.txt"), entry(r"C:\b.txt")];
        assert!(search(&entries, "   ", 10).is_empty());
        assert_eq!(search(&entries, "txt", 1).len(), 1);
    }

    #[test]
    fn exact_and_prefix_names_rank_first() {
        let entries = vec![
            entry(r"C:\my report.txt"),
            entry(r"C:\report.txt"),
            entry(r"C:\report-final.txt"),
        ];
        let hits = search(&entries, "report", 50);
        assert_eq!(hits[0].name(), "report.txt");
        assert_eq!(hits[1].name(), "report-final.txt");
    }
}
