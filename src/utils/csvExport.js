export function exportTicketsToCsv(ticketsToExport, filename, showError) {
  if (ticketsToExport.length === 0) {
    if (showError) showError("Error: No registrations match the export criteria!");
    return;
  }

  const allQuestionLabels = new Set();
  ticketsToExport.forEach(t => {
    if (t.answers) {
      Object.keys(t.answers).forEach(label => {
        allQuestionLabels.add(label);
      });
    }
  });
  const labelsArray = Array.from(allQuestionLabels);

  let csvContent = "\ufeff";
  csvContent += "Email,Ticket ID,Ticket Status,Approval Status,Payment,Timestamp";
  labelsArray.forEach(label => {
    const escapedLabel = label.replace(/"/g, '""');
    csvContent += `,"${escapedLabel}"`;
  });
  csvContent += "\n";

  ticketsToExport.forEach(t => {
    const email = t.email;
    const id = t.id;
    const status = t.status;
    const approval = t.approval || 'approved';
    const payment = t.payment || 'offline';
    const timestamp = (t.timestamp || '').replace(/"/g, '""');

    let rowStr = `"${email}","${id}","${status}","${approval}","${payment}","${timestamp}"`;

    labelsArray.forEach(label => {
      const answer = (t.answers && t.answers[label] !== undefined) ? String(t.answers[label]) : '';
      const escapedAnswer = answer.replace(/"/g, '""');
      rowStr += `,"${escapedAnswer}"`;
    });

    csvContent += rowStr + "\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
