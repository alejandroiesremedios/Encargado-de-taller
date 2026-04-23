// API UNIVERSAL V2.7 - DINÁMICA (Gestión de Carpetas + Gestión de Hojas)
// Propuesta para nueva versión con creación automática de pestañas
var ROOT_FOLDER_ID = '12Zkv7ZZ1o0twyBmdeMyavbrsiEElAHWK'; 

function doPost(e) {
  var sheet;
  var lastRow;
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. DETERMINAR NOMBRE DE LA HOJA (Usa el tipo de actividad o el módulo)
    var sheetName = data.tipo || data.modulo || "General";
    sheet = ss.getSheetByName(sheetName);

    // 2. SI LA HOJA NO EXISTE, CREARLA E INICIALIZAR ENCABEZADOS
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = [["Fecha", "Nombre", "Ejercicio", "Nota", "PDF"]];
      sheet.getRange(1, 1, 1, 5).setValues(headers)
           .setBackground("#1e3a8a")
           .setFontColor("white")
           .setFontWeight("bold")
           .setFontSize(11)
           .setFontFamily("Roboto")
           .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    var moduloName = data.modulo || (data.ejercicio ? data.ejercicio.split(' ')[0] : 'General');
    var actividadName = data.tipo || 'Resultados';

    // --- 1. GUARDAR DATOS ---
    var newRow = [data.fecha, data.nombre, data.ejercicio, data.nota, ''];
    sheet.appendRow(newRow);
    lastRow = sheet.getLastRow();

    // --- 2. FORMATO EN LA HOJA (Aplicado a la fila recién creada) ---
    var range = sheet.getRange(lastRow, 1, 1, 5);
    range.setFontFamily("Roboto").setFontSize(10).setVerticalAlignment("middle").setHorizontalAlignment("center");
    if (lastRow % 2 == 0) { range.setBackground("#f8fafc"); }

    var scoreCell = sheet.getRange(lastRow, 4);
    var scoreValue = parseFloat(String(data.nota).replace(',', '.'));
    if (scoreValue >= 5) {
      scoreCell.setFontColor("#155724").setBackground("#d4edda").setFontWeight("bold");
    } else {
      scoreCell.setFontColor("#721c24").setBackground("#f8d7da").setFontWeight("bold");
    }

    // --- 3. DRIVE (GUARDADO DINÁMICO DE 2 NIVELES) ---
    if (data.pdf) {
      try {
        var pdfBytes = Utilities.base64Decode(data.pdf);
        var pdfBlob = Utilities.newBlob(pdfBytes, 'application/pdf', data.pdfNombre || (data.nombre + '.pdf'));
        var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
        
        var moduloFolders = rootFolder.getFoldersByName(moduloName);
        var moduloFolder = moduloFolders.hasNext() ? moduloFolders.next() : rootFolder.createFolder(moduloName);
        
        var actividadFolders = moduloFolder.getFoldersByName(actividadName);
        var actividadFolder = actividadFolders.hasNext() ? actividadFolders.next() : moduloFolder.createFolder(actividadName);
        
        var pdfFile = actividadFolder.createFile(pdfBlob);
        
        var pdfCell = sheet.getRange(lastRow, 5);
        pdfCell.setValue(pdfFile.getUrl());
        pdfCell.setFontColor("#1a56db").setFontWeight("bold");
      } catch (pdfError) { /* Silencioso */ }
    }
    return ContentService.createTextOutput("Exito").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}
