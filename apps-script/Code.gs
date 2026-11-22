function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (data.secret !== secret) return ContentService.createTextOutput('forbidden');

  SpreadsheetApp.getActiveSheet().appendRow([
    new Date(),
    data.name,
    data.email,
    data.submitted,
    JSON.stringify(data.answers),
  ]);
  return ContentService.createTextOutput('ok');
}
