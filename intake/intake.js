(function () {
  'use strict';

  // ---- Configuration ----
  var API_URL = 'https://truenas-scale.taildbbb4c.ts.net/api/submit';

  // ---- Signature Pads ----
  var signaturePads = {};

  function initSignaturePads() {
    document.querySelectorAll('canvas[data-sig]').forEach(function (canvas) {
      var wrapper = canvas.parentElement;
      var ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      signaturePads[canvas.dataset.sig] = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(10, 37, 64)'
      });
    });
  }

  window.clearSignature = function (btn) {
    var canvas = btn.closest('.signature-block').querySelector('canvas');
    var pad = signaturePads[canvas.dataset.sig];
    if (pad) pad.clear();
  };

  // ---- Form Picker ----
  var pickerSection = document.getElementById('picker-section');
  var allForms = document.querySelectorAll('.intake-form');
  var confirmation = document.getElementById('confirmation');

  window.showPicker = function () {
    allForms.forEach(function (f) { f.classList.remove('active'); });
    confirmation.classList.remove('active');
    pickerSection.style.display = '';
    window.scrollTo({ top: pickerSection.offsetTop - 80, behavior: 'smooth' });
  };

  function showForm(formId) {
    pickerSection.style.display = 'none';
    allForms.forEach(function (f) { f.classList.remove('active'); });
    confirmation.classList.remove('active');
    var target = document.getElementById('form-' + formId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: target.closest('section').offsetTop - 80, behavior: 'smooth' });
      initSignaturePadsInForm(target);
    }
  }

  function initSignaturePadsInForm(formEl) {
    formEl.querySelectorAll('canvas[data-sig]').forEach(function (canvas) {
      if (!signaturePads[canvas.dataset.sig]) {
        var ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d').scale(ratio, ratio);
        signaturePads[canvas.dataset.sig] = new SignaturePad(canvas, {
          backgroundColor: 'rgb(255, 255, 255)',
          penColor: 'rgb(10, 37, 64)'
        });
      }
    });
  }

  document.querySelectorAll('.form-picker .card[data-form]').forEach(function (card) {
    if (card.classList.contains('disabled')) return;
    card.addEventListener('click', function () {
      showForm(card.dataset.form);
    });
  });

  // ---- Expand/Collapse ----
  window.toggleExpand = function (btn, targetId) {
    var target = document.getElementById(targetId);
    var isVisible = target.classList.contains('visible');
    target.classList.toggle('visible');
    if (btn.textContent.charAt(0) === '+') {
      btn.textContent = btn.textContent.replace('+', '−');
    } else {
      btn.textContent = btn.textContent.replace('−', '+');
    }

    // Show/hide second signature row when adding second buyer/seller
    if (targetId === 'buyer2-section-bi') {
      document.getElementById('buyer2-sig-row-bi').style.display = isVisible ? 'none' : '';
    }
    if (targetId === 'seller2-section-si') {
      document.getElementById('seller2-sig-row-si').style.display = isVisible ? 'none' : '';
    }
  };

  // ---- Conditional Fields ----
  window.toggleConditional = function (el, targetId, forceShow) {
    var target = document.getElementById(targetId);
    if (forceShow) {
      target.classList.add('visible');
    } else if (el.type === 'checkbox') {
      if (el.checked) {
        target.classList.remove('visible');
      } else {
        target.classList.add('visible');
      }
    }
  };

  window.togglePostAddr = function (targetId, show) {
    var target = document.getElementById(targetId);
    if (show) {
      target.classList.add('visible');
    } else {
      target.classList.remove('visible');
    }
  };

  window.toggleNoMortgages = function (checkbox) {
    var form = checkbox.closest('form');
    var lenderBlocks = form.querySelector('[id^="lender-blocks-"]');
    if (checkbox.checked) {
      lenderBlocks.style.display = 'none';
    } else {
      lenderBlocks.style.display = '';
    }
  };

  // ---- Set date fields to today ----
  function setDefaultDates() {
    var today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(function (input) {
      if (!input.value) input.value = today;
    });
  }

  // ---- Validation ----
  function validateForm(form) {
    var valid = true;

    form.querySelectorAll('input.error').forEach(function (el) {
      el.classList.remove('error');
    });
    form.querySelectorAll('.signature-canvas-wrap.error').forEach(function (el) {
      el.classList.remove('error');
    });

    // HTML5 validation
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }

    // Check required signatures
    var formContainer = form.closest('.intake-form');
    var requiredSigs = formContainer.querySelectorAll('.signature-label .required');
    requiredSigs.forEach(function (req) {
      var block = req.closest('.signature-block');
      var canvas = block.querySelector('canvas');
      var pad = signaturePads[canvas.dataset.sig];
      if (!pad || pad.isEmpty()) {
        block.querySelector('.signature-canvas-wrap').classList.add('error');
        valid = false;
      }
    });

    if (!valid) {
      var firstError = form.querySelector('.signature-canvas-wrap.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return valid;
  }

  // ---- Collect Form Data ----
  function collectFormData(form) {
    var data = {};
    var formData = new FormData(form);
    for (var pair of formData.entries()) {
      if (data[pair[0]]) {
        if (!Array.isArray(data[pair[0]])) {
          data[pair[0]] = [data[pair[0]]];
        }
        data[pair[0]].push(pair[1]);
      } else {
        data[pair[0]] = pair[1];
      }
    }

    // Collect checkbox states (unchecked ones aren't in FormData)
    form.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      if (cb.name && !(cb.name in data)) {
        data[cb.name] = false;
      } else if (cb.name && cb.checked) {
        data[cb.name] = true;
      }
    });

    return data;
  }

  // ---- Collect Signatures ----
  function collectSignatures(form) {
    var sigs = {};
    var formContainer = form.closest('.intake-form');
    formContainer.querySelectorAll('canvas[data-sig]').forEach(function (canvas) {
      var pad = signaturePads[canvas.dataset.sig];
      if (pad && !pad.isEmpty()) {
        sigs[canvas.dataset.sig] = pad.toDataURL('image/png');
      }
    });
    return sigs;
  }

  // ---- PDF Generation ----
  async function generatePDF(formType, formData, signatures) {
    var PDFLib = window.PDFLib;
    var pdfDoc = await PDFLib.PDFDocument.create();
    var font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    var fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    var fontSize = 10;
    var lineHeight = 14;
    var margin = 50;
    var navy = PDFLib.rgb(10 / 255, 37 / 255, 64 / 255);
    var teal = PDFLib.rgb(58 / 255, 175 / 255, 169 / 255);
    var gray = PDFLib.rgb(74 / 255, 74 / 255, 90 / 255);

    var formTitles = {
      buyer_individual: "Buyer's Pre-Closing Information Sheet",
      buyer_entity: "Entity Buyer's Pre-Closing Information Sheet",
      seller_individual: "Seller's Pre-Closing Information Sheet",
      seller_entity: "Entity Seller Pre-Closing Information Sheet",
      seller_authorization: "Authorization for Release of Information"
    };

    var pageWidth = 612;
    var pageHeight = 792;
    var contentWidth = pageWidth - margin * 2;
    var y = pageHeight - margin;
    var page = pdfDoc.addPage([pageWidth, pageHeight]);

    function newPage() {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      return page;
    }

    function checkSpace(needed) {
      if (y - needed < margin) newPage();
    }

    function drawHeader() {
      page.drawText('JENKINS TITLE LLC', { x: margin, y: y, size: 14, font: fontBold, color: navy });
      y -= 20;
      page.drawText(formTitles[formType] || formType, { x: margin, y: y, size: 12, font: fontBold, color: teal });
      y -= 8;
      page.drawLine({ start: { x: margin, y: y }, end: { x: pageWidth - margin, y: y }, thickness: 1, color: teal });
      y -= 20;
    }

    function drawField(label, value) {
      if (!value || value === 'false') return;
      checkSpace(lineHeight * 2);
      page.drawText(label + ':', { x: margin, y: y, size: 8, font: fontBold, color: gray });
      y -= lineHeight;
      var displayVal = String(value);
      if (displayVal.length > 80) {
        var words = displayVal.split(' ');
        var line = '';
        words.forEach(function (word) {
          var test = line ? line + ' ' + word : word;
          if (font.widthOfTextAtSize(test, fontSize) > contentWidth) {
            page.drawText(line, { x: margin, y: y, size: fontSize, font: font, color: navy });
            y -= lineHeight;
            checkSpace(lineHeight);
            line = word;
          } else {
            line = test;
          }
        });
        if (line) {
          page.drawText(line, { x: margin, y: y, size: fontSize, font: font, color: navy });
          y -= lineHeight;
        }
      } else {
        page.drawText(displayVal, { x: margin, y: y, size: fontSize, font: font, color: navy });
        y -= lineHeight;
      }
      y -= 4;
    }

    function drawSectionTitle(title) {
      checkSpace(30);
      y -= 8;
      page.drawText(title, { x: margin, y: y, size: 11, font: fontBold, color: navy });
      y -= 4;
      page.drawLine({ start: { x: margin, y: y }, end: { x: pageWidth - margin, y: y }, thickness: 0.5, color: PDFLib.rgb(0.91, 0.89, 0.87) });
      y -= 14;
    }

    async function drawSignature(label, sigDataUrl) {
      if (!sigDataUrl) return;
      checkSpace(70);
      page.drawText(label, { x: margin, y: y, size: 8, font: fontBold, color: gray });
      y -= 4;
      var sigBytes = Uint8Array.from(atob(sigDataUrl.split(',')[1]), function (c) { return c.charCodeAt(0); });
      var sigImage = await pdfDoc.embedPng(sigBytes);
      var sigDims = sigImage.scale(0.4);
      if (sigDims.width > contentWidth) {
        var scale = contentWidth / sigDims.width;
        sigDims = { width: sigDims.width * scale, height: sigDims.height * scale };
      }
      y -= sigDims.height;
      page.drawImage(sigImage, { x: margin, y: y, width: sigDims.width, height: sigDims.height });
      y -= 10;
    }

    // Build PDF content
    drawHeader();

    if (formData.order_number) drawField('Order Number', formData.order_number);
    drawField('Property Address', formData.property_address);

    // Form-type-specific fields
    var fieldMappings = {
      buyer_individual: [
        { section: 'Buyer 1', fields: [['Full Legal Name', 'buyer1_name'], ['Home Phone', 'buyer1_home_phone'], ['Work Phone', 'buyer1_work_phone'], ['Cell Phone', 'buyer1_cell_phone'], ['Email', 'buyer1_email'], ['Last 4 SSN', 'buyer1_ssn_last4']] },
        { section: 'Buyer 2', fields: [['Full Legal Name', 'buyer2_name'], ['Home Phone', 'buyer2_home_phone'], ['Work Phone', 'buyer2_work_phone'], ['Cell Phone', 'buyer2_cell_phone'], ['Email', 'buyer2_email'], ['Last 4 SSN', 'buyer2_ssn_last4']] },
        { section: 'Closing Details', fields: [['Mail-Away', 'mail_away'], ['POA', 'poa'], ['Marital Status', 'marital_status']] },
        { section: 'Mailing', fields: [['Current Mailing Address', 'current_mailing_address'], ['Post-Closing Address', 'post_closing_address']] },
        { section: 'Document Delivery', fields: [['Physical Documents', 'physical_docs'], ['Mail To', 'physical_docs_address']] }
      ],
      buyer_entity: [
        { section: 'Entity Information', fields: [['Entity Legal Name', 'entity_legal_name'], ['State of Formation', 'state_of_formation'], ['EIN', 'ein'], ['Contact Person', 'contact_person'], ['Contact Email', 'contact_email'], ['Contact Phone', 'contact_phone'], ['CC Emails', 'cc_emails'], ['Signer Name', 'signer_name'], ['Signer Title', 'signer_title']] },
        { section: 'Closing Details', fields: [['Mail-Away', 'mail_away'], ['Mail-Away State', 'mail_away_state']] },
        { section: 'Mailing', fields: [['Current Mailing Address', 'current_mailing_address'], ['Post-Closing Address', 'post_closing_address']] },
        { section: 'Title Vesting', fields: [['Pro Rata', 'pro_rata'], ['Percentages', 'pro_rata_percentages']] },
        { section: 'Document Delivery', fields: [['Physical Documents', 'physical_docs'], ['Mail To', 'physical_docs_address']] }
      ],
      seller_individual: [
        { section: 'Seller 1', fields: [['Full Legal Name', 'seller1_name'], ['Home Phone', 'seller1_home_phone'], ['Work Phone', 'seller1_work_phone'], ['Cell Phone', 'seller1_cell_phone'], ['Email', 'seller1_email'], ['SSN/EIN', 'seller1_ssn']] },
        { section: 'Seller 2', fields: [['Full Legal Name', 'seller2_name'], ['Home Phone', 'seller2_home_phone'], ['Work Phone', 'seller2_work_phone'], ['Cell Phone', 'seller2_cell_phone'], ['Email', 'seller2_email'], ['SSN/EIN', 'seller2_ssn'], ['Relationship', 'seller_relationship']] },
        { section: 'Closing Details', fields: [['Mail-Away', 'mail_away'], ['POA', 'poa'], ['Deceased Owner', 'deceased_owner'], ['Marital Status', 'marital_status']] },
        { section: 'Tax Questionnaire', fields: [['Resident of Property State', 'tax_resident'], ['U.S. Citizen/Permanent Resident', 'tax_us_citizen'], ['Primary Residence 2/5yr', 'tax_primary_residence'], ['Homestead Exemption', 'tax_homestead'], ['Filing in Property State', 'tax_filing'], ['Active Lawsuit', 'tax_lawsuit'], ['Divorce', 'tax_divorce'], ['Bankruptcy', 'tax_bankruptcy'], ['Property Tax Appeal', 'tax_appeal'], ['Lease on Property', 'tax_lease']] },
        { section: 'Mailing', fields: [['Current Mailing Address', 'current_mailing_address'], ['Post-Closing Address', 'post_closing_address']] },
        { section: '1st Lender', fields: [['Lender Name', 'lender1_name'], ['Loan Number', 'lender1_loan_number'], ['Phone', 'lender1_phone'], ['Email', 'lender1_email']] },
        { section: '2nd Lender', fields: [['Lender Name', 'lender2_name'], ['Loan Number', 'lender2_loan_number'], ['Phone', 'lender2_phone'], ['Email', 'lender2_email']] },
        { section: '3rd Lender', fields: [['Lender Name', 'lender3_name'], ['Loan Number', 'lender3_loan_number'], ['Phone', 'lender3_phone'], ['Email', 'lender3_email']] },
        { section: 'Other Liens', fields: [['Creditor', 'other_lien_name'], ['Account/Case #', 'other_lien_account'], ['Contact', 'other_lien_contact'], ['Phone', 'other_lien_phone']] },
        { section: 'HOA', fields: [['Mandatory HOA', 'hoa_mandatory'], ['HOA Name', 'hoa_name'], ['Subdivision', 'hoa_subdivision'], ['Management Company', 'hoa_mgmt_company'], ['Contact', 'hoa_contact'], ['Phone', 'hoa_phone'], ['Email', 'hoa_email'], ['Water/Sewer by HOA', 'hoa_water_sewer']] },
        { section: 'Utilities & Associations', fields: [['Fire Dues', 'fire_dues'], ['Library Dues', 'library_dues'], ['Other Dues', 'other_dues'], ['Water/Sewer Provider', 'water_sewer_provider'], ['Solid Waste Provider', 'solid_waste_provider']] }
      ],
      seller_entity: [
        { section: 'Entity Information', fields: [['Entity Legal Name', 'entity_legal_name'], ['State of Formation', 'state_of_formation'], ['EIN', 'ein'], ['Contact Person', 'contact_person'], ['Contact Email', 'contact_email'], ['Contact Phone', 'contact_phone'], ['CC Emails', 'cc_emails']] },
        { section: 'Closing Document Signer', fields: [['Signer Name', 'signer_name'], ['Signer Title', 'signer_title'], ['Mail-Away', 'mail_away']] },
        { section: 'Tax Questionnaire', fields: [['Domestic Entity of Property State', 'tax_domestic'], ['Active Lawsuit', 'tax_lawsuit'], ['Bankruptcy', 'tax_bankruptcy'], ['Property Tax Appeal', 'tax_appeal'], ['Lease on Property', 'tax_lease']] },
        { section: 'Mailing', fields: [['Current Mailing Address', 'current_mailing_address'], ['Post-Closing Address', 'post_closing_address']] },
        { section: '1st Lender', fields: [['Lender Name', 'lender1_name'], ['Loan Number', 'lender1_loan_number'], ['Phone', 'lender1_phone'], ['Email', 'lender1_email']] },
        { section: '2nd Lender', fields: [['Lender Name', 'lender2_name'], ['Loan Number', 'lender2_loan_number'], ['Phone', 'lender2_phone'], ['Email', 'lender2_email']] },
        { section: '3rd Lender', fields: [['Lender Name', 'lender3_name'], ['Loan Number', 'lender3_loan_number'], ['Phone', 'lender3_phone'], ['Email', 'lender3_email']] },
        { section: 'Other Liens', fields: [['Creditor', 'other_lien_name'], ['Account/Case #', 'other_lien_account'], ['Phone', 'other_lien_phone'], ['Email', 'other_lien_email']] },
        { section: 'HOA', fields: [['Mandatory HOA', 'hoa_mandatory'], ['HOA Name', 'hoa_name'], ['Subdivision', 'hoa_subdivision'], ['Management Company', 'hoa_mgmt_company'], ['Contact', 'hoa_contact'], ['Phone', 'hoa_phone'], ['Email', 'hoa_email'], ['Water/Sewer by HOA', 'hoa_water_sewer']] },
        { section: 'Utilities & Associations', fields: [['Fire Dues', 'fire_dues'], ['Library Dues', 'library_dues'], ['Other Dues', 'other_dues'], ['Water/Sewer Provider', 'water_sewer_provider'], ['Solid Waste Provider', 'solid_waste_provider']] }
      ],
      seller_authorization: [
        { section: 'Lender Information', fields: [['1st Lender', 'lender1_name'], ['1st Loan #', 'lender1_loan_number'], ['2nd Lender', 'lender2_name'], ['2nd Loan #', 'lender2_loan_number'], ['3rd Lender', 'lender3_name'], ['3rd Loan #', 'lender3_loan_number']] }
      ]
    };

    var mapping = fieldMappings[formType] || [];
    for (var s = 0; s < mapping.length; s++) {
      var section = mapping[s];
      var hasData = section.fields.some(function (f) {
        var val = formData[f[1]];
        return val && val !== 'false' && val !== '';
      });
      if (!hasData) continue;
      drawSectionTitle(section.section);
      for (var f = 0; f < section.fields.length; f++) {
        drawField(section.fields[f][0], formData[section.fields[f][1]]);
      }
    }

    // Authorization text for seller forms
    if (formType.startsWith('seller')) {
      checkSpace(60);
      drawSectionTitle('Authorization & Certification');
      var certText = 'The information provided is complete and accurate. Jenkins Title, LLC may rely on it in completing the necessary closing documents.';
      page.drawText(certText, { x: margin, y: y, size: 8, font: font, color: gray, maxWidth: contentWidth });
      y -= 30;
    }

    // Signatures
    drawSectionTitle('Signatures');
    for (var sigKey in signatures) {
      var sigLabel = sigKey.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
      await drawSignature(sigLabel, signatures[sigKey]);
    }

    // Date
    var sigDateField = formData.signature_date || formData.seller1_signature_date || '';
    if (sigDateField) {
      drawField('Date', sigDateField);
    }

    // Footer on last page
    y = margin - 10;
    page.drawText('PH 678-572-1910 | 416 Pirkle Ferry Rd, L-100, Cumming GA 30040 | FX 678-572-1916', {
      x: margin, y: 25, size: 7, font: font, color: gray
    });

    return await pdfDoc.save();
  }

  // ---- Download PDF ----
  function downloadPDF(pdfBytes, formType) {
    var blob = new Blob([pdfBytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var timestamp = new Date().toISOString().slice(0, 10);
    a.download = 'Jenkins-Title-' + formType.replace(/_/g, '-') + '-' + timestamp + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return blob;
  }

  // ---- Submit Handler ----
  window.handleSubmit = async function (event) {
    event.preventDefault();
    var form = event.target;
    var formType = form.dataset.formType;

    if (!validateForm(form)) return false;

    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating PDF...';

    try {
      var formData = collectFormData(form);
      var signatures = collectSignatures(form);

      var pdfBytes = await generatePDF(formType, formData, signatures);
      var pdfBlob = downloadPDF(pdfBytes, formType);

      // Submit to backend if configured
      if (API_URL) {
        submitBtn.textContent = 'Submitting...';
        var pdfBase64 = await blobToBase64(pdfBlob);
        var payload = {
          form_type: formType,
          order_number: formData.order_number || null,
          property_address: formData.property_address,
          data: formData,
          signatures: Object.keys(signatures),
          pdf: pdfBase64
        };

        var response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error('Submission failed: ' + response.status);
        }
      }

      // Show confirmation
      allForms.forEach(function (f) { f.classList.remove('active'); });
      confirmation.classList.add('active');
      window.scrollTo({ top: confirmation.closest('section').offsetTop - 80, behavior: 'smooth' });

    } catch (err) {
      console.error('Submission error:', err);
      alert('Your signed PDF has been downloaded. ' +
        (API_URL ? 'However, there was an error submitting to our server. Please email the downloaded PDF to closing@jenkinstitle.com.' : 'Please email it to closing@jenkinstitle.com.'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }

    return false;
  };

  function blobToBase64(blob) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onloadend = function () { resolve(reader.result); };
      reader.readAsDataURL(blob);
    });
  }

  // ---- Resize handler for signature canvases ----
  var resizeTimeout;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      Object.keys(signaturePads).forEach(function (key) {
        var pad = signaturePads[key];
        var canvas = pad.canvas;
        var data = pad.toData();
        var ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d').scale(ratio, ratio);
        pad.clear();
        if (data.length) pad.fromData(data);
      });
    }, 250);
  });

  // ---- Init ----
  setDefaultDates();
})();
