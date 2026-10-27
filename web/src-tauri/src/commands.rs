use chrono::Local;
use std::{fs, io, path::PathBuf};

use tauri::{AppHandle, Manager};

const SAVE_SUBDIR: &str = "My Games/Bulder/saves";

fn saves_path(app: &AppHandle) -> Result<PathBuf, String> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| format!("Не удалось получить папку «Документы»: {e}"))?;
    Ok(docs.join(SAVE_SUBDIR))
}

fn ensure_dir(dir: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("Не удалось создать папку сохранений: {e}"))
}

fn is_valid_save_name(name: &str) -> bool {
    let Some(stem) = name.strip_suffix(".json") else {
        return false;
    };
    let Some(rest) = stem.strip_prefix("save_") else {
        return false;
    };
    let all_digits = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    let Some((date_part, rest)) = rest.split_once('_') else {
        return false;
    };
    if date_part.len() != 8 || !all_digits(date_part) {
        return false;
    }
    let (time_part, suffix) = match rest.split_once('_') {
        Some((time, suffix)) => (time, suffix),
        None => (rest, ""),
    };
    if time_part.len() != 6 || !all_digits(time_part) {
        return false;
    }
    if !suffix.is_empty() && !all_digits(suffix) {
        return false;
    }
    true
}

fn validate_file_name(file_name: &str) -> Result<(), String> {
    if is_valid_save_name(file_name) {
        Ok(())
    } else {
        Err("Недопустимое имя файла сохранения.".into())
    }
}

#[tauri::command]
pub fn list_saves(app: AppHandle) -> Result<Vec<String>, String> {
    let dir = saves_path(&app)?;
    ensure_dir(&dir)?;
    let mut names = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Не удалось прочитать папку сохранений: {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Ошибка чтения папки сохранений: {e}"))?;
        let is_file = entry
            .file_type()
            .map(|t| t.is_file())
            .unwrap_or(false);
        if is_file {
            let name = entry.file_name().to_string_lossy().into_owned();
            if is_valid_save_name(&name) {
                names.push(name);
            }
        }
    }
    names.sort();
    names.reverse();
    Ok(names)
}

#[tauri::command]
pub fn load_save(app: AppHandle, file_name: String) -> Result<Option<String>, String> {
    validate_file_name(&file_name)?;
    let dir = saves_path(&app)?;
    let path = dir.join(&file_name);
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Не удалось прочитать сохранение: {e}")),
    }
}

#[tauri::command]
pub fn write_save(app: AppHandle, file_name: String, contents: String) -> Result<(), String> {
    validate_file_name(&file_name)?;
    let dir = saves_path(&app)?;
    ensure_dir(&dir)?;
    fs::write(dir.join(&file_name), contents).map_err(|e| format!("Не удалось записать сохранение: {e}"))
}

#[tauri::command]
pub fn create_save(app: AppHandle, contents: String) -> Result<String, String> {
    let dir = saves_path(&app)?;
    ensure_dir(&dir)?;
    let base = format!("save_{}", Local::now().format("%Y%m%d_%H%M%S"));
    let mut name = format!("{base}.json");
    let mut counter = 2;
    while dir.join(&name).exists() {
        name = format!("{base}_{counter}.json");
        counter += 1;
    }
    fs::write(dir.join(&name), contents).map_err(|e| format!("Не удалось создать сохранение: {e}"))?;
    Ok(name)
}

#[tauri::command]
pub fn save_dir(app: AppHandle) -> Result<String, String> {
    let dir = saves_path(&app)?;
    ensure_dir(&dir)?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn exit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}