/**
 * client/src/utils/hindiTranslator.js
 * Bulletproof Hindi translation helper for all UI notifications, toasts, and error messages.
 */

const EXACT_MAP = {
  // Auth & Session
  'Login successful!': 'लॉगिन सफल रहा!',
  'Signed out successfully.': 'सफलतापूर्वक साइन आउट हो गए।',
  'Logged out successfully.': 'सफलतापूर्वक साइन आउट हो गए।',
  'Unauthorized session. Please log in.': 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।',
  'Account is deactivated or invalid.': 'खाता निष्क्रिय या अमान्य है। कृपया एडमिन से संपर्क करें।',
  'Account is deactivated. Contact Admin.': 'खाता निष्क्रिय है। कृपया एडमिन से संपर्क करें।',
  'Invalid Username or Password.': 'अमान्य यूज़रनेम या पासवर्ड।',
  'Username and Password are required.': 'यूज़रनेम और पासवर्ड दोनों आवश्यक हैं।',
  'Username and password are required.': 'यूज़रनेम और पासवर्ड दोनों आवश्यक हैं।',
  'Password must be at least 6 characters long.': 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।',
  'New password must be at least 6 characters long.': 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।',
  'Current password and new password are required.': 'वर्तमान पासवर्ड और नया पासवर्ड दोनों आवश्यक हैं।',
  'Current password is incorrect.': 'वर्तमान पासवर्ड गलत है।',
  'New password and confirm password do not match.': 'नया पासवर्ड और कन्फर्म पासवर्ड मेल नहीं खाते।',
  'Password changed successfully!': 'पासवर्ड सफलतापूर्वक बदल दिया गया!',
  'Password updated successfully!': 'पासवर्ड सफलतापूर्वक अपडेट हो गया!',
  'Failed to update password.': 'पासवर्ड अपडेट करने में विफलता।',
  'Could not change password.': 'पासवर्ड नहीं बदला जा सका।',
  'Failed to change password.': 'पासवर्ड बदलने में विफलता।',
  'Please enter your current password.': 'कृपया अपना वर्तमान पासवर्ड दर्ज करें।',
  'You have been logged out due to 15 minutes of inactivity.': '15 मिनट तक कोई गतिविधि न होने के कारण आप स्वतः लॉग आउट हो गए हैं।',

  // Records
  'PID is required.': 'PID दर्ज करना अनिवार्य है।',
  'PID must contain numbers only.': 'PID में केवल अंक (Numbers) होने चाहिए।',
  'Name is required.': 'नाम दर्ज करना अनिवार्य है।',
  'PID already exists.': 'यह PID पहले से मौजूद है।',
  'Aadhar No already exists.': 'यह आधार नंबर पहले से मौजूद है।',
  'Aadhar No must contain at least 12 digits.': 'आधार नंबर में कम से कम 12 अंक होने चाहिए।',
  'Record created successfully!': 'रिकॉर्ड सफलतापूर्वक बनाया गया!',
  'Record added successfully!': 'रिकॉर्ड सफलतापूर्वक जोड़ा गया!',
  'Record updated successfully!': 'रिकॉर्ड सफलतापूर्वक अपडेट हो गया!',
  'Record deleted successfully!': 'रिकॉर्ड सफलतापूर्वक डिलीट कर दिया गया!',
  'Record deleted successfully.': 'रिकॉर्ड सफलतापूर्वक डिलीट कर दिया गया।',
  'Failed to add record.': 'रिकॉर्ड जोड़ने में विफलता।',
  'Failed to update record.': 'रिकॉर्ड अपडेट करने में विफलता।',
  'Failed to delete record.': 'रिकॉर्ड डिलीट करने में विफलता।',
  'Error saving record.': 'रिकॉर्ड सेव करने में त्रुटि आई।',
  'Error updating record.': 'रिकॉर्ड अपडेट करने में त्रुटि आई।',
  'Error deleting record.': 'रिकॉर्ड डिलीट करने में त्रुटि आई।',
  'Target record not found.': 'लक्षित रिकॉर्ड नहीं मिला।',
  'Record not found.': 'रिकॉर्ड नहीं मिला।',
  'Enter valid date. Future dates are not allowed. Today or previous dates are allowed.': 'अमान्य दिनांक। भविष्य की तारीख दर्ज नहीं की जा सकती। केवल आज या पुरानी तारीख दर्ज करें।',
  'Aadhar No. is mandatory according to system settings.': 'सिस्टम सेटिंग्स के अनुसार आधार नंबर अनिवार्य है।',
  'You do not have permission to edit this record (Only own records within 12h allowed).': 'आपको यह रिकॉर्ड एडिट करने की अनुमति नहीं है (केवल स्वयं द्वारा 12 घंटे के भीतर बनाए गए रिकॉर्ड एडिट किए जा सकते हैं)।',
  'You do not have permission to delete this record (Only own records within 12h allowed).': 'आपको यह रिकॉर्ड डिलीट करने की अनुमति नहीं है (केवल स्वयं द्वारा 12 घंटे के भीतर बनाए गए रिकॉर्ड डिलीट किए जा सकते हैं)।',
  'A record with this PID is currently being processed. Please wait.': 'इस PID के रिकॉर्ड पर कार्य प्रक्रियाधीन है। कृपया प्रतीक्षा करें।',
  'View users cannot add records.': 'केवल व्यू (View) अनुमति वाले यूज़र नया रिकॉर्ड नहीं जोड़ सकते।',

  // Police Station
  'Police Station name is required.': 'थाने (PS) का नाम दर्ज करना आवश्यक है।',
  'Police Station (PS Name) is required.': 'थाने (PS) का नाम दर्ज करना आवश्यक है।',
  'Police Station added successfully!': 'थाना सफलतापूर्वक जोड़ा गया!',
  'Police Station added successfully.': 'थाना सफलतापूर्वक जोड़ा गया।',
  'Police station deleted.': 'थाना सफलतापूर्वक डिलीट किया गया।',
  'Police Station deleted successfully.': 'थाना सफलतापूर्वक डिलीट किया गया।',
  'Failed to add police station.': 'थाना जोड़ने में विफलता।',
  'Failed to update police station.': 'थाना अपडेट करने में विफलता।',
  'Failed to delete police station.': 'थाना डिलीट करने में विफलता।',
  'Failed to delete selected police stations.': 'चयनित थाने डिलीट करने में विफलता।',
  'Error adding police station.': 'थाना जोड़ने में त्रुटि आई।',
  'Error updating police station.': 'थाना अपडेट करने में त्रुटि आई।',
  'Error deleting police station.': 'थाना डिलीट करने में त्रुटि आई।',
  'Error deleting police stations.': 'थाने डिलीट करने में त्रुटि आई।',
  'Police Station entry not found.': 'थाना रिकॉर्ड नहीं मिला।',
  'No police station IDs provided for deletion.': 'डिलीट करने के लिए कोई थाना आईडी नहीं मिली।',

  // Users
  'User created successfully!': 'नया यूज़र सफलतापूर्वक बनाया गया!',
  'User permissions updated successfully!': 'यूज़र अनुमतियाँ सफलतापूर्वक अपडेट की गईं!',
  'Failed to create user.': 'यूज़र बनाने में विफलता।',
  'Failed to update user.': 'यूज़र अपडेट करने में विफलता।',
  'Failed to delete user.': 'यूज़र डिलीट करने में विफलता।',
  'Error creating user.': 'यूज़र बनाने में त्रुटि आई।',
  'Error updating user.': 'यूज़र अपडेट करने में त्रुटि आई।',
  'Error deleting user.': 'यूज़र डिलीट करने में त्रुटि आई।',
  'User not found.': 'यूज़र नहीं मिला।',
  'Username already exists.': 'यह यूज़रनेम पहले से मौजूद है।',
  'Username is required.': 'यूज़रनेम आवश्यक है।',
  'Password is required.': 'पासवर्ड आवश्यक है।',
  'New password cannot be empty.': 'नया पासवर्ड खाली नहीं हो सकता।',
  'User password reset successfully in Cloudflare.': 'यूज़र पासवर्ड सफलतापूर्वक रीसेट हो गया।',
  'Import permission updated.': 'इम्पोर्ट अनुमति अपडेट हो गई।',
  'Full access updated.': 'पूर्ण अनुमति (Full Access) अपडेट हो गई।',
  'Delete request permission updated.': 'डिलीट रिक्वेस्ट अनुमति अपडेट हो गई।',
  'PS List permission updated.': 'थाना सूची अनुमति अपडेट हो गई।',
  'User status updated.': 'यूज़र स्थिति अपडेट हो गई।',
  'You cannot delete your own account while logged in.': 'आप लॉग इन रहते हुए अपना खाता डिलीट नहीं कर सकते।',

  // Import / Export
  'Please select an Excel or CSV file to import.': 'कृपया इम्पोर्ट करने के लिए एक्सेल या CSV फ़ाइल चुनें।',
  'Data imported successfully!': 'डेटा सफलतापूर्वक इम्पोर्ट हो गया!',
  'Import failed.': 'इम्पोर्ट विफल रहा।',
  'Error uploading file.': 'फ़ाइल अपलोड करने में त्रुटि आई।',
  'Batch import completed successfully.': 'बैच इम्पोर्ट सफलतापूर्वक संपन्न हुआ।',
  'Exported EXCEL successfully!': 'एक्सेल फ़ाइल सफलतापूर्वक डाउनलोड हो गई!',
  'Exported CSV successfully!': 'CSV फ़ाइल सफलतापूर्वक डाउनलोड हो गई!',
  'Failed to export records': 'रिकॉर्ड्स निर्यात (Export) करने में विफलता।',

  // Settings
  'System settings updated successfully.': 'सिस्टम सेटिंग्स सफलतापूर्वक अपडेट हो गईं।',
  'Option value is required.': 'विकल्प का मान आवश्यक है।',
  'Option name cannot be empty.': 'विकल्प का नाम खाली नहीं हो सकता।',

  // Network & HTTP Status Codes
  'Failed to fetch': 'सर्वर से संपर्क नहीं हो पाया। कृपया नेटवर्क चेक करें।',
  'Network Error': 'नेटवर्क कनेक्शन में त्रुटि है।',
  'Request failed with status 404': 'अनुरोधित डेटा या सेवा नहीं मिली (404)।',
  'Request failed with status 403': 'इस कार्य को करने के लिए अनुमति नहीं है (403)।',
  'Request failed with status 400': 'अमान्य अनुरोध (400)।',
  'Request failed with status 401': 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें (401)।',
  'Request failed with status 500': 'सर्वर में आंतरिक त्रुटि आई (500)।',
  'Request failed with status 409': 'डेटा में टकराव (Conflict) है। कृपया दोबारा प्रयास करें।'
};

/**
 * Translates any English notification message into Hindi / Hinglish.
 * If message already contains Devanagari characters, returns it unmodified.
 */
export function translateToHindi(msg) {
  if (!msg) return '';
  if (typeof msg !== 'string') {
    try {
      msg = String(msg);
    } catch (_) {
      return '';
    }
  }

  const trimmed = msg.trim();
  if (!trimmed) return '';

  // If already purely in Hindi (Devanagari Unicode \u0900-\u097F), keep as-is
  // But wait: if it contains an English status like "Request failed with status 404", translate that part!
  if (/[\u0900-\u097F]/.test(trimmed) && !/Request failed with status|Error|Failed/i.test(trimmed)) {
    return trimmed;
  }

  // Exact Match
  if (EXACT_MAP[trimmed]) {
    return EXACT_MAP[trimmed];
  }

  let t = trimmed;

  // Split composite messages like "Error X: Request failed with status 404"
  if (t.includes(': ')) {
    const parts = t.split(': ');
    const prefix = parts[0].trim();
    const rest = parts.slice(1).join(': ').trim();

    const translatedRest = EXACT_MAP[rest] || (
      /Request failed with status (\d+)/i.test(rest)
        ? `सर्वर अनुरोध विफल रहा (कोड: ${rest.match(/Request failed with status (\d+)/i)[1]})`
        : rest
    );

    if (/^Error permanently deleting/i.test(prefix)) {
      return `रिकॉर्ड्स हमेशा के लिए डिलीट करने में त्रुटि: ${translatedRest}`;
    }
    if (/^Error restoring/i.test(prefix)) {
      return `रिकॉर्ड्स रीस्टोर करने में त्रुटि: ${translatedRest}`;
    }
    if (/^Error loading requests/i.test(prefix)) {
      return `अनुरोध सूची लोड करने में समस्या आई: ${translatedRest}`;
    }
    if (/^Error loading records/i.test(prefix)) {
      return `डेटा रिकॉर्ड लोड करने में समस्या आई: ${translatedRest}`;
    }
    if (/^Error loading (.*)/i.test(prefix)) {
      return `डेटा लोड करने में समस्या आई: ${translatedRest}`;
    }
    if (/^Error exporting/i.test(prefix)) {
      return `फ़ाइल डाउनलोड करने में त्रुटि: ${translatedRest}`;
    }
    if (/^Error deleting police stations/i.test(prefix)) {
      return `थाने डिलीट करने में त्रुटि आई: ${translatedRest}`;
    }
    if (/^Error deleting/i.test(prefix)) {
      return `डिलीट करने में त्रुटि: ${translatedRest}`;
    }
    if (/^Error updating/i.test(prefix)) {
      return `अपडेट करने में त्रुटि: ${translatedRest}`;
    }
    if (/^Error adding/i.test(prefix)) {
      return `जोड़ने में त्रुटि: ${translatedRest}`;
    }
    if (/^Error saving/i.test(prefix)) {
      return `सेव करने में त्रुटि: ${translatedRest}`;
    }
  }

  // HTTP status fallback in message
  if (/Request failed with status 404/i.test(t)) {
    return 'अनुरोधित डेटा या सेवा नहीं मिली (404)।';
  }
  if (/Request failed with status 403/i.test(t)) {
    return 'इस कार्य को करने के लिए अनुमति नहीं है (403)।';
  }
  if (/Request failed with status (\d+)/i.test(t)) {
    const code = t.match(/Request failed with status (\d+)/i)[1];
    return `सर्वर अनुरोध विफल रहा (कोड: ${code})।`;
  }

  // Welcome back, USER!
  if (/^welcome back,\s*(.+)!?$/i.test(t)) {
    const user = t.replace(/^welcome back,\s*/i, '').replace(/!$/, '');
    return `वापसी पर स्वागत है, ${user}!`;
  }

  // Record with PID "..." already exists!
  if (/Record with PID ["']?([^"']+)["']? already exists/i.test(t)) {
    const m = t.match(/Record with PID ["']?([^"']+)["']? already exists/i);
    return `PID "${m[1]}" का रिकॉर्ड पहले से मौजूद है!`;
  }

  // Password for USER updated!
  if (/Password for (.+) updated/i.test(t)) {
    const m = t.match(/Password for (.+) updated/i);
    return `${m[1]} का पासवर्ड सफलतापूर्वक अपडेट कर दिया गया!`;
  }

  // User "USER" deleted.
  if (/User ["']?([^"']+)["']? deleted/i.test(t)) {
    const m = t.match(/User ["']?([^"']+)["']? deleted/i);
    return `यूज़र "${m[1]}" सफलतापूर्वक डिलीट कर दिया गया।`;
  }

  // User "USER" created successfully
  if (/User ["']?([^"']+)["']? created/i.test(t)) {
    const m = t.match(/User ["']?([^"']+)["']? created/i);
    return `यूज़र "${m[1]}" सफलतापूर्वक बनाया गया!`;
  }

  // Police Station "NAME" added successfully.
  if (/Police Station ["']?([^"']+)["']? added/i.test(t)) {
    const m = t.match(/Police Station ["']?([^"']+)["']? added/i);
    return `थाना "${m[1]}" सफलतापूर्वक जोड़ दिया गया!`;
  }

  // Police Station "NAME" updated successfully.
  if (/Police Station ["']?([^"']+)["']? updated/i.test(t)) {
    const m = t.match(/Police Station ["']?([^"']+)["']? updated/i);
    return `थाना "${m[1]}" सफलतापूर्वक अपडेट हो गया!`;
  }

  // Deleted N police stations successfully!
  if (/Deleted (\d+) police stations/i.test(t)) {
    const m = t.match(/Deleted (\d+) police stations/i);
    return `चयनित ${m[1]} थाने सफलतापूर्वक डिलीट कर दिए गए!`;
  }

  // Remark option "..." added!
  if (/Remark option ["']?([^"']+)["']? added/i.test(t)) {
    const m = t.match(/Remark option ["']?([^"']+)["']? added/i);
    return `रिमार्क विकल्प "${m[1]}" जोड़ दिया गया!`;
  }

  // Remark option "..." deleted.
  if (/Remark option ["']?([^"']+)["']? deleted/i.test(t)) {
    const m = t.match(/Remark option ["']?([^"']+)["']? deleted/i);
    return `रिमार्क विकल्प "${m[1]}" डिलीट कर दिया गया।`;
  }

  // Delete reason "..." added!
  if (/Delete reason ["']?([^"']+)["']? added/i.test(t)) {
    const m = t.match(/Delete reason ["']?([^"']+)["']? added/i);
    return `डिलीट कारण "${m[1]}" जोड़ दिया गया!`;
  }

  // Delete reason "..." deleted.
  if (/Delete reason ["']?([^"']+)["']? deleted/i.test(t)) {
    const m = t.match(/Delete reason ["']?([^"']+)["']? deleted/i);
    return `डिलीट कारण "${m[1]}" डिलीट कर दिया गया।`;
  }

  // Mandatory Aadhar enforcement Enabled/Disabled
  if (/Mandatory Aadhar enforcement (Enabled|Disabled)/i.test(t)) {
    const isEn = /Enabled/i.test(t);
    return `अनिवार्य आधार सत्यापन ${isEn ? 'सक्षम (Enabled)' : 'अक्षम (Disabled)'} कर दिया गया।`;
  }

  // Exported FORMAT successfully!
  if (/Exported\s+([A-Z]+)\s+successfully/i.test(t)) {
    const m = t.match(/Exported\s+([A-Z]+)\s+successfully/i);
    return `फ़ाइल (${m[1]}) सफलतापूर्वक डाउनलोड हो गई!`;
  }

  // General Error / Failed prefix
  if (/^Error:\s*(.*)$/i.test(t)) {
    return `त्रुटि: ${t.replace(/^Error:\s*/i, '')}`;
  }

  return t;
}
