// Enhanced loading state fixes for admin dashboard

// Daily Run Summary - Enhanced with loading states
async function loadRunSummary(){
  const date = qs('runDate')?.value || todayISO();
  const metaDiv = qs('runMeta');
  const tbody = qs('runDeptRows');
  const missingDiv = qs('runMissing');
  
  try {
    // Show loading state
    if(metaDiv) metaDiv.innerHTML = '<span class="badge">⏳ පූරණය වෙමින්...</span>';
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" class="mini" style="text-align:center; padding:16px;">⏳ දත්ත පූරණය වෙමින්...</td></tr>';
    if(missingDiv) {
      missingDiv.innerHTML = 'පූරණය වෙමින්...';
      missingDiv.className = 'alert';
    }
    
    const data = await api(`/admin/run/${date}/summary`);
    
    // Update meta info
    if(metaDiv) {
      const master = data.master_request 
        ? `Master Request: #${data.master_request.id} (${data.master_request.status})` 
        : 'Master Request: නැත (OPEN)';
      metaDiv.innerHTML = `
        <span class="badge brand">${date}</span> 
        <span class="badge">${master}</span> 
        <span class="badge ok">Submitted: ${data.submitted_departments || 0}</span> 
        <span class="badge ${(data.missing_departments?.length || 0) > 0 ? 'bad' : 'ok'}">Missing: ${data.missing_departments?.length || 0}</span>
      `;
    }
    
    // Update department table
    if(tbody) {
      if(data.departments && data.departments.length > 0) {
        tbody.innerHTML = data.departments.map(r => `
          <tr>
            <td><strong>${r.department_name}</strong></td>
            <td>${r.submitted ? '<span class="badge ok">✅ ඔව්</span>' : '<span class="badge bad">❌ නෑ</span>'}</td>
            <td><span class="badge">${r.requests_count || 0}</span></td>
            <td><span class="badge">${r.employees_count || 0}</span></td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="mini" style="text-align:center; padding:16px;">දත්ත නැත</td></tr>';
      }
    }
    
    // Update missing departments
    if(missingDiv) {
      const missing = data.missing_departments || [];
      if(missing.length > 0) {
        missingDiv.innerHTML = `<ul style="margin:0; padding-left:18px;">${missing.map(n=>`<li><strong>${n}</strong></li>`).join('')}</ul>`;
        missingDiv.className = 'alert warn';
      } else {
        missingDiv.innerHTML = '✅ සියල්ලම ලැබී ඇත';
        missingDiv.className = 'alert ok';
      }
    }
    
  } catch(e) {
    console.error('Load run summary error:', e);
    
    // Show error state
    if(metaDiv) {
      metaDiv.innerHTML = '<span class="badge bad">⚠️ දෝෂයක් සිදු විය</span>';
    }
    
    if(tbody) {
      const errorMessage = e.message.includes('404') || e.message.includes('not found')
        ? 'ℹ️ මෙම දිනය සඳහා දත්ත නොමැත'
        : `⚠️ දෝෂයක්: ${e.message}`;
      
      tbody.innerHTML = `<tr><td colspan="4" class="mini" style="text-align:center; padding:16px; color:var(--muted);">${errorMessage}</td></tr>`;
    }
    
    if(missingDiv) {
      missingDiv.innerHTML = 'දත්ත පූරණය කිරීමට නොහැකි විය';
      missingDiv.className = 'alert error';
    }
    
    toast('❌ දෝෂයක්: ' + e.message);
  }
}

// Initialize - call on page load
async function initAdminDashboard() {
  // Set default date
  setDefaultRunDate();
  
  // Load run summary with delay to avoid race conditions
  setTimeout(async () => {
    await loadRunSummary();
  }, 300);
}

// Call this instead of direct loadRunSummary()
// initAdminDashboard();
