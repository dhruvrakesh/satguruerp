import { useMutation } from "@tanstack/react-query";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export interface PDFReportData {
  title: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
  summary: {
    totalItems: number;
    totalValue: number;
    [key: string]: any;
  };
  data: any[];
  chartElements?: string[]; // CSS selectors for chart elements to capture
}

export const usePDFReportGeneration = () => {
  return useMutation({
    mutationFn: async (reportData: PDFReportData) => {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let currentY = 20;

      // Add title
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text(reportData.title, pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;

      // Add generation date
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated on: ${format(new Date(), 'PPP')}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 10;

      // Add date range if provided
      if (reportData.dateRange?.from || reportData.dateRange?.to) {
        const dateRangeText = `Report Period: ${
          reportData.dateRange.from ? format(new Date(reportData.dateRange.from), 'PP') : 'Start'
        } - ${
          reportData.dateRange.to ? format(new Date(reportData.dateRange.to), 'PP') : 'End'
        }`;
        pdf.text(dateRangeText, pageWidth / 2, currentY, { align: 'center' });
        currentY += 15;
      }

      // Add summary section
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Summary', 20, currentY);
      currentY += 10;

      pdf.setFontSize(10);
      Object.entries(reportData.summary).forEach(([key, value]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        let displayValue = value;
        
        if (key.toLowerCase().includes('value') || key.toLowerCase().includes('cost')) {
          displayValue = formatCurrency(Number(value));
        } else if (typeof value === 'number') {
          displayValue = value.toLocaleString();
        }

        pdf.text(`${label}: ${displayValue}`, 20, currentY);
        currentY += 5;
      });

      currentY += 10;

      // Capture and add charts if specified
      if (reportData.chartElements && reportData.chartElements.length > 0) {
        for (const selector of reportData.chartElements) {
          const element = document.querySelector(selector) as HTMLElement;
          if (element) {
            try {
              const canvas = await html2canvas(element, {
                backgroundColor: '#ffffff',
                scale: 1,
                logging: false,
              });

              const imgData = canvas.toDataURL('image/png');
              const imgWidth = Math.min(pageWidth - 40, 160);
              const imgHeight = (canvas.height * imgWidth) / canvas.width;

              // Check if image fits on current page
              if (currentY + imgHeight > pageHeight - 20) {
                pdf.addPage();
                currentY = 20;
              }

              pdf.addImage(imgData, 'PNG', 20, currentY, imgWidth, imgHeight);
              currentY += imgHeight + 10;
            } catch (error) {
              console.warn('Failed to capture chart:', selector, error);
            }
          }
        }
      }

      // Add data table
      if (reportData.data.length > 0) {
        // Check if we need a new page for the table
        if (currentY > pageHeight - 60) {
          pdf.addPage();
          currentY = 20;
        }

        pdf.setFontSize(14);
        pdf.text('Detailed Data', 20, currentY);
        currentY += 10;

        // Table headers
        const headers = Object.keys(reportData.data[0]);
        const colWidth = (pageWidth - 40) / headers.length;

        pdf.setFontSize(8);
        pdf.setFont(undefined, 'bold');
        headers.forEach((header, index) => {
          const x = 20 + (index * colWidth);
          const headerText = header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          pdf.text(headerText, x, currentY);
        });

        pdf.setFont(undefined, 'normal');
        currentY += 7;

        // Table rows
        reportData.data.slice(0, 50).forEach((row, rowIndex) => { // Limit to 50 rows for PDF
          if (currentY > pageHeight - 20) {
            pdf.addPage();
            currentY = 20;
          }

          headers.forEach((header, colIndex) => {
            const x = 20 + (colIndex * colWidth);
            let cellValue = row[header]?.toString() || '';
            
            // Format values based on column type
            if (header.toLowerCase().includes('value') || header.toLowerCase().includes('cost')) {
              cellValue = formatCurrency(Number(row[header]) || 0);
            } else if (header.toLowerCase().includes('date')) {
              cellValue = row[header] ? format(new Date(row[header]), 'PP') : '';
            }

            // Truncate long text
            if (cellValue.length > 15) {
              cellValue = cellValue.substring(0, 12) + '...';
            }

            pdf.text(cellValue, x, currentY);
          });

          currentY += 5;
        });

        if (reportData.data.length > 50) {
          currentY += 5;
          pdf.setFontSize(8);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`... and ${reportData.data.length - 50} more items`, 20, currentY);
        }
      }

      // Add footer
      const footerY = pageHeight - 10;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Generated by Stock Management System', pageWidth / 2, footerY, { align: 'center' });

      // Save the PDF
      const fileName = `${reportData.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);

      return { success: true, fileName };
    },
    onError: (error) => {
      console.error('PDF generation failed:', error);
      throw new Error('Failed to generate PDF report');
    },
  });
};