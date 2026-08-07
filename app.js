/* =========================================================
   Haldia LPG Bottling Plant — Inventory Control
   Pure client-side app. Data persists in localStorage so it
   works fully offline and can be hosted as a static site
   (e.g. GitHub Pages) with zero backend.
   ========================================================= */

const STORAGE_KEY   = 'haldia_lpg_inventory_items';
const LOG_KEY        = 'haldia_lpg_inventory_log';

const CATEGORIES = [
  'Filled Cylinder - 14.2kg (Domestic)',
  'Filled Cylinder - 19kg (Commercial)',
  'Filled Cylinder - 5kg (Domestic FTL)',
  'Filled Cylinder - 47.5kg (Commercial)',
  'Empty Cylinder - Returned',
  'Empty Cylinder - Defective/Rejected',
  'LPG Bulk Stock',
  'Valve',
  'Regulator',
  'Safety Cap / Seal Ring',
  'PPE / Safety Equipment',
  'Spares & Tools',
  'Other'
];

let state = {
  items: load(STORAGE_KEY, []),
  log:   load(LOG_KEY, []),
  editingId: null,
  amendItemId: null,
  amendType: 'IN',
  deleteId: null,
  filters: { search:'', category:'', status:'', sort:'name-asc' }
};

/* ---------------- storage helpers ---------------- */
function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  localStorage.setItem(LOG_KEY, JSON.stringify(state.log));
}
function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* ---------------- status helpers ---------------- */
function stockStatus(item){
  if(item.qty <= 0) return 'out';
  if(item.qty <= item.reorder) return 'low';
  return 'normal';
}
function statusBadge(status){
  const map = { out:['out','OUT OF STOCK'], low:['low','LOW STOCK'], normal:['ok','NORMAL'] };
  const [cls,label] = map[status];
  return `<span class="badge ${cls}">${label}</span>`;
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) + ' ' +
         d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
}
function money(n){
  return '₹' + Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
}

/* ---------------- toast ---------------- */
let toastTimer;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove('show'), 2600);
}

/* =========================================================
   NAVIGATION
   ========================================================= */
const views = ['dashboard','inventory','add','log'];
function showView(name){
  views.forEach(v=>{
    document.getElementById('view-'+v).classList.toggle('hidden', v!==name);
  });
  document.querySelectorAll('.nav-item').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  const titles = { dashboard:'Dashboard', inventory:'Inventory', add:'Add Item', log:'Stock Movement Log' };
  document.getElementById('viewTitle').textContent = titles[name];

  if(name === 'dashboard') renderDashboard();
  if(name === 'inventory') renderInventory();
  if(name === 'log') renderFullLog();
  if(name === 'add' && state.editingId === null){
    resetForm();
  }
}
document.getElementById('mainNav').addEventListener('click', e=>{
  const btn = e.target.closest('.nav-item');
  if(!btn) return;
  showView(btn.dataset.view);
});
document.querySelectorAll('[data-goto]').forEach(btn=>{
  btn.addEventListener('click', ()=> showView(btn.dataset.goto));
});

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard(){
  const items = state.items;
  const totalSkus = items.length;
  const lowStock = items.filter(i=> stockStatus(i)==='low').length;
  const outStock = items.filter(i=> stockStatus(i)==='out').length;
  const totalValue = items.reduce((sum,i)=> sum + (i.qty * (i.price||0)), 0);

  const grid = document.getElementById('statGrid');
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total SKUs Tracked</div>
      <div class="stat-value">${totalSkus}</div>
    </div>
    <div class="stat-card warn">
      <div class="stat-label">Low Stock Items</div>
      <div class="stat-value">${lowStock}</div>
    </div>
    <div class="stat-card bad">
      <div class="stat-label">Out of Stock</div>
      <div class="stat-value">${outStock}</div>
    </div>
    <div class="stat-card good">
      <div class="stat-label">Total Inventory Value</div>
      <div class="stat-value" style="font-size:22px">${money(totalValue)}</div>
    </div>
  `;

  // Gauges — one per category that has items, showing stock vs reorder threshold
  const gaugeGrid = document.getElementById('gaugeGrid');
  const byCategory = {};
  items.forEach(i=>{
    if(!byCategory[i.category]) byCategory[i.category] = { qty:0, reorder:0, count:0 };
    byCategory[i.category].qty += i.qty;
    byCategory[i.category].reorder += i.reorder;
    byCategory[i.category].count += 1;
  });
  const cats = Object.keys(byCategory);
  if(cats.length === 0){
    gaugeGrid.innerHTML = `<p class="empty-state">No items yet. Add your first item to see stock gauges here.</p>`;
  } else {
    gaugeGrid.innerHTML = cats.map(cat=>{
      const d = byCategory[cat];
      const threshold = d.reorder || 1;
      let pct = Math.min(100, Math.round((d.qty / (threshold*2)) * 100)); // 2x reorder level = "full" gauge
      if(d.qty === 0) pct = 0;
      let color = 'var(--good)';
      if(d.qty <= threshold) color = 'var(--bad)';
      else if(d.qty <= threshold*1.5) color = 'var(--warn)';
      return `
        <div class="gauge-card">
          <div class="gauge" style="background:conic-gradient(${color} ${pct}%, #E7E9EB ${pct}% 100%)">
            <span class="gauge-value">${pct}%</span>
          </div>
          <div class="gauge-name">${cat}</div>
          <div class="gauge-qty">${d.qty} in stock</div>
        </div>
      `;
    }).join('');
  }

  // Recent movements (top 6)
  const recent = [...state.log].sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,6);
  const tbody = document.querySelector('#recentLogTable tbody');
  tbody.innerHTML = recent.length ? recent.map(logRowHtml).join('') :
    `<tr><td colspan="6" class="empty-state">No stock movements recorded yet.</td></tr>`;
}

function logRowHtml(l){
  const typeClass = l.type === 'IN' ? 'in' : (l.type === 'OUT' ? 'outmove' : 'adjust');
  const sign = l.qtyChange > 0 ? '+' : '';
  return `<tr>
    <td>${fmtDate(l.date)}</td>
    <td class="wrap">${l.itemName}</td>
    <td><span class="badge ${typeClass}">${l.type}</span></td>
    <td>${sign}${l.qtyChange}</td>
    <td>${l.resultingQty}</td>
    <td class="wrap">${l.reason}</td>
  </tr>`;
}

/* =========================================================
   INVENTORY TABLE + FILTERS
   ========================================================= */
function populateCategoryDropdowns(){
  const filterSel = document.getElementById('filterCategory');
  const formSel = document.getElementById('f_category');
  filterSel.innerHTML = `<option value="">All Categories</option>` +
    CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('');
  formSel.innerHTML = CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('');
}

function getFilteredItems(){
  let items = [...state.items];
  const { search, category, status, sort } = state.filters;

  if(search){
    const q = search.toLowerCase();
    items = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      (i.supplier||'').toLowerCase().includes(q)
    );
  }
  if(category){ items = items.filter(i=> i.category === category); }
  if(status){ items = items.filter(i=> stockStatus(i) === status); }

  items.sort((a,b)=>{
    switch(sort){
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'qty-asc': return a.qty - b.qty;
      case 'qty-desc': return b.qty - a.qty;
      case 'updated-desc': return new Date(b.updatedAt) - new Date(a.updatedAt);
      default: return 0;
    }
  });
  return items;
}

function renderInventory(){
  const items = getFilteredItems();
  const tbody = document.getElementById('inventoryBody');
  const emptyEl = document.getElementById('inventoryEmpty');

  if(items.length === 0){
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  tbody.innerHTML = items.map(item=>{
    const status = stockStatus(item);
    return `
      <tr data-id="${item.id}">
        <td><span style="font-family:var(--font-mono)">${item.sku}</span></td>
        <td class="wrap">${item.name}</td>
        <td class="wrap">${item.category}</td>
        <td style="font-family:var(--font-mono); font-weight:600">${item.qty}</td>
        <td>${item.unit}</td>
        <td style="font-family:var(--font-mono)">${item.reorder}</td>
        <td>${statusBadge(status)}</td>
        <td class="wrap">${item.location || '—'}</td>
        <td style="font-family:var(--font-mono)">${item.price ? money(item.price) : '—'}</td>
        <td class="wrap">${item.supplier || '—'}</td>
        <td>${fmtDate(item.updatedAt)}</td>
        <td class="col-actions">
          <div class="row-actions">
            <button class="icon-btn amend" data-action="amend" data-id="${item.id}">Amend Qty</button>
            <button class="icon-btn edit" data-action="edit" data-id="${item.id}">Edit</button>
            <button class="icon-btn delete" data-action="delete" data-id="${item.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

document.getElementById('inventoryBody').addEventListener('click', e=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if(action === 'edit') openEditForm(id);
  if(action === 'amend') openAmendModal(id);
  if(action === 'delete') openDeleteModal(id);
});

// filter bar events
document.getElementById('searchInput').addEventListener('input', e=>{
  state.filters.search = e.target.value; renderInventory();
});
document.getElementById('filterCategory').addEventListener('change', e=>{
  state.filters.category = e.target.value; renderInventory();
});
document.getElementById('filterStatus').addEventListener('change', e=>{
  state.filters.status = e.target.value; renderInventory();
});
document.getElementById('sortBy').addEventListener('change', e=>{
  state.filters.sort = e.target.value; renderInventory();
});
document.getElementById('clearFilters').addEventListener('click', ()=>{
  state.filters = { search:'', category:'', status:'', sort:'name-asc' };
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('sortBy').value = 'name-asc';
  renderInventory();
});

/* =========================================================
   ADD / EDIT ITEM FORM
   ========================================================= */
const itemForm = document.getElementById('itemForm');

function resetForm(){
  state.editingId = null;
  itemForm.reset();
  document.getElementById('itemId').value = '';
  document.getElementById('formTitle').textContent = 'Add New Item';
  document.getElementById('submitBtn').textContent = 'Add Item to Inventory';
  document.getElementById('f_qty').disabled = false;
}

function openEditForm(id){
  const item = state.items.find(i=> i.id === id);
  if(!item) return;
  state.editingId = id;
  document.getElementById('itemId').value = item.id;
  document.getElementById('f_name').value = item.name;
  document.getElementById('f_sku').value = item.sku;
  document.getElementById('f_category').value = item.category;
  document.getElementById('f_unit').value = item.unit;
  document.getElementById('f_qty').value = item.qty;
  document.getElementById('f_qty').disabled = true; // qty changed via Amend, not edit
  document.getElementById('f_reorder').value = item.reorder;
  document.getElementById('f_price').value = item.price || '';
  document.getElementById('f_supplier').value = item.supplier || '';
  document.getElementById('f_location').value = item.location || '';
  document.getElementById('f_remarks').value = item.remarks || '';
  document.getElementById('formTitle').textContent = 'Edit Item Details';
  document.getElementById('submitBtn').textContent = 'Save Changes';
  showView('add');
}

document.getElementById('cancelEditBtn').addEventListener('click', ()=>{
  resetForm();
  showView('inventory');
});

itemForm.addEventListener('submit', e=>{
  e.preventDefault();

  const name = document.getElementById('f_name').value.trim();
  const sku = document.getElementById('f_sku').value.trim();
  const category = document.getElementById('f_category').value;
  const unit = document.getElementById('f_unit').value;
  const qty = Number(document.getElementById('f_qty').value);
  const reorder = Number(document.getElementById('f_reorder').value);
  const price = Number(document.getElementById('f_price').value) || 0;
  const supplier = document.getElementById('f_supplier').value.trim();
  const location = document.getElementById('f_location').value.trim();
  const remarks = document.getElementById('f_remarks').value.trim();

  if(!name || !sku || !category || qty < 0 || reorder < 0){
    toast('Please fill all required fields correctly.');
    return;
  }

  // duplicate SKU check (excluding the item being edited)
  const dupe = state.items.find(i=> i.sku.toLowerCase() === sku.toLowerCase() && i.id !== state.editingId);
  if(dupe){
    toast('An item with this SKU / Batch No. already exists.');
    return;
  }

  if(state.editingId){
    const item = state.items.find(i=> i.id === state.editingId);
    Object.assign(item, { name, sku, category, unit, reorder, price, supplier, location, remarks, updatedAt: new Date().toISOString() });
    toast('Item details updated.');
  } else {
    const newItem = {
      id: uid('item'),
      name, sku, category, unit, qty, reorder, price, supplier, location, remarks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.items.push(newItem);
    if(qty > 0){
      addLog(newItem, 'IN', qty, qty, 'Opening Stock');
    }
    toast('Item added to inventory.');
  }

  persist();
  resetForm();
  showView('inventory');
});

/* =========================================================
   AMEND QUANTITY MODAL
   ========================================================= */
const amendModal = document.getElementById('amendModal');
const amendQtyInput = document.getElementById('amendQtyInput');
const amendQtyLabel = document.getElementById('amendQtyLabel');
const amendPreview = document.getElementById('amendPreview');

function openAmendModal(id){
  const item = state.items.find(i=> i.id === id);
  if(!item) return;
  state.amendItemId = id;
  state.amendType = 'IN';
  document.querySelectorAll('.amend-type').forEach(b=> b.classList.toggle('active', b.dataset.type==='IN'));
  document.getElementById('amendItemName').textContent = item.name;
  document.getElementById('amendCurrentQty').textContent = item.qty;
  document.getElementById('amendUnit').textContent = item.unit;
  amendQtyInput.value = '';
  amendQtyLabel.textContent = 'Quantity to Add';
  updateAmendPreview();
  amendModal.classList.remove('hidden');
}
document.querySelectorAll('.amend-type').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.amend-type').forEach(b=> b.classList.remove('active'));
    btn.classList.add('active');
    state.amendType = btn.dataset.type;
    amendQtyLabel.textContent =
      state.amendType === 'IN' ? 'Quantity to Add' :
      state.amendType === 'OUT' ? 'Quantity to Remove' : 'New Exact Quantity';
    updateAmendPreview();
  });
});
amendQtyInput.addEventListener('input', updateAmendPreview);

function updateAmendPreview(){
  const item = state.items.find(i=> i.id === state.amendItemId);
  if(!item) return;
  const val = Number(amendQtyInput.value) || 0;
  let result;
  if(state.amendType === 'IN') result = item.qty + val;
  else if(state.amendType === 'OUT') result = item.qty - val;
  else result = val;
  result = Math.max(0, result);
  amendPreview.textContent = `${item.qty} ${item.unit} → ${result} ${item.unit}`;
}

document.getElementById('amendCancelBtn').addEventListener('click', ()=> amendModal.classList.add('hidden'));

document.getElementById('amendConfirmBtn').addEventListener('click', ()=>{
  const item = state.items.find(i=> i.id === state.amendItemId);
  if(!item) return;
  const val = Number(amendQtyInput.value);
  if(isNaN(val) || val < 0){ toast('Enter a valid quantity.'); return; }

  const reason = document.getElementById('amendReason').value;
  const before = item.qty;
  let after, qtyChange, logType;

  if(state.amendType === 'IN'){
    after = before + val; qtyChange = val; logType = 'IN';
  } else if(state.amendType === 'OUT'){
    if(val > before){ toast('Cannot remove more than current stock.'); return; }
    after = before - val; qtyChange = -val; logType = 'OUT';
  } else {
    after = val; qtyChange = val - before; logType = 'ADJUST';
  }

  item.qty = after;
  item.updatedAt = new Date().toISOString();
  addLog(item, logType, qtyChange, after, reason);
  persist();
  amendModal.classList.add('hidden');
  toast('Quantity updated.');
  renderInventory();
  renderDashboard();
});

function addLog(item, type, qtyChange, resultingQty, reason){
  state.log.push({
    id: uid('log'),
    itemId: item.id,
    itemName: item.name,
    sku: item.sku,
    type, qtyChange, resultingQty, reason,
    date: new Date().toISOString()
  });
}

/* =========================================================
   DELETE MODAL
   ========================================================= */
const deleteModal = document.getElementById('deleteModal');
function openDeleteModal(id){
  const item = state.items.find(i=> i.id === id);
  if(!item) return;
  state.deleteId = id;
  document.getElementById('deleteItemName').textContent = item.name;
  deleteModal.classList.remove('hidden');
}
document.getElementById('deleteCancelBtn').addEventListener('click', ()=> deleteModal.classList.add('hidden'));
document.getElementById('deleteConfirmBtn').addEventListener('click', ()=>{
  state.items = state.items.filter(i=> i.id !== state.deleteId);
  persist();
  deleteModal.classList.add('hidden');
  toast('Item deleted.');
  renderInventory();
  renderDashboard();
});

/* =========================================================
   FULL LOG VIEW
   ========================================================= */
function renderFullLog(){
  const tbody = document.querySelector('#fullLogTable tbody');
  const emptyEl = document.getElementById('logEmpty');
  const rows = [...state.log].sort((a,b)=> new Date(b.date)-new Date(a.date));
  if(rows.length === 0){
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  tbody.innerHTML = rows.map(l=>{
    const typeClass = l.type === 'IN' ? 'in' : (l.type === 'OUT' ? 'outmove' : 'adjust');
    const sign = l.qtyChange > 0 ? '+' : '';
    return `<tr>
      <td>${fmtDate(l.date)}</td>
      <td class="wrap">${l.itemName}</td>
      <td style="font-family:var(--font-mono)">${l.sku||''}</td>
      <td><span class="badge ${typeClass}">${l.type}</span></td>
      <td>${sign}${l.qtyChange}</td>
      <td>${l.resultingQty}</td>
      <td class="wrap">${l.reason}</td>
    </tr>`;
  }).join('');
}

/* =========================================================
   CSV EXPORT / IMPORT
   ========================================================= */
document.getElementById('exportBtn').addEventListener('click', ()=>{
  if(state.items.length === 0){ toast('No items to export yet.'); return; }
  const headers = ['SKU','Name','Category','Quantity','Unit','ReorderLevel','PricePerUnit','Supplier','Location','Remarks','CreatedAt','UpdatedAt'];
  const rows = state.items.map(i=> [
    i.sku, i.name, i.category, i.qty, i.unit, i.reorder, i.price, i.supplier, i.location,
    (i.remarks||'').replace(/[\r\n,]+/g,' '), i.createdAt, i.updatedAt
  ]);
  const csv = [headers.join(','), ...rows.map(r=> r.map(csvEscape).join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `haldia-lpg-inventory-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Inventory exported as CSV.');
});
function csvEscape(val){
  const s = String(val ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}

document.getElementById('importBtn').addEventListener('click', ()=> document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = evt=>{
    try{
      const lines = evt.target.result.split(/\r?\n/).filter(l=> l.trim().length);
      const [headerLine, ...dataLines] = lines;
      let imported = 0, skipped = 0;
      dataLines.forEach(line=>{
        const cols = parseCsvLine(line);
        if(cols.length < 6) { skipped++; return; }
        const [sku,name,category,qty,unit,reorder,price,supplier,location,remarks] = cols;
        if(!sku || !name){ skipped++; return; }
        if(state.items.some(i=> i.sku.toLowerCase() === sku.toLowerCase())){ skipped++; return; }
        state.items.push({
          id: uid('item'), sku, name,
          category: CATEGORIES.includes(category) ? category : 'Other',
          qty: Number(qty)||0, unit: unit || 'Nos', reorder: Number(reorder)||0,
          price: Number(price)||0, supplier: supplier||'', location: location||'', remarks: remarks||'',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        imported++;
      });
      persist();
      renderInventory();
      renderDashboard();
      toast(`Imported ${imported} item(s)${skipped ? `, skipped ${skipped}` : ''}.`);
    }catch(err){
      toast('Could not parse CSV file.');
    }
    document.getElementById('importFile').value = '';
  };
  reader.readAsText(file);
});
function parseCsvLine(line){
  const result = [];
  let cur = '', inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(inQuotes){
      if(ch === '"' && line[i+1] === '"'){ cur += '"'; i++; }
      else if(ch === '"'){ inQuotes = false; }
      else cur += ch;
    } else {
      if(ch === '"') inQuotes = true;
      else if(ch === ','){ result.push(cur); cur=''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/* =========================================================
   SAMPLE DATA + RESET
   ========================================================= */
document.getElementById('seedBtn').addEventListener('click', ()=>{
  if(state.items.length && !confirm('This will add sample items alongside existing data. Continue?')) return;
  const samples = [
    ['HLD-FC142-001','Filled Cylinder 14.2kg (Domestic)','Filled Cylinder - 14.2kg (Domestic)',420,'Nos',150,850,'IOCL Haldia Depot','Shed A - Filled Yard'],
    ['HLD-FC19-002','Filled Cylinder 19kg (Commercial)','Filled Cylinder - 19kg (Commercial)',85,'Nos',100,1650,'IOCL Haldia Depot','Shed A - Filled Yard'],
    ['HLD-FC5-003','Filled Cylinder 5kg (FTL)','Filled Cylinder - 5kg (Domestic FTL)',310,'Nos',80,410,'IOCL Haldia Depot','Shed B'],
    ['HLD-EC-004','Empty Cylinder - Returned','Empty Cylinder - Returned',260,'Nos',100,0,'Distributor Returns','Shed C - Empty Yard'],
    ['HLD-EC-005','Empty Cylinder - Defective','Empty Cylinder - Defective/Rejected',18,'Nos',10,0,'Quality Inspection','Rejection Bay'],
    ['HLD-BULK-006','LPG Bulk Storage','LPG Bulk Stock',420,'KL',150,42000,'IOCL Refinery Line','Bullet Tank 1'],
    ['HLD-VLV-007','LPG Cylinder Valve (Standard)','Valve',640,'Nos',300,95,'Superior Valve Industries','Store Room 1'],
    ['HLD-REG-008','LPG Regulator (19mm)','Regulator',12,'Nos',50,180,'Precision Fittings Ltd','Store Room 1'],
    ['HLD-SEAL-009','Safety Seal Ring (Pack of 100)','Safety Cap / Seal Ring',24,'Nos',20,220,'Rubber Components Co.','Store Room 2'],
    ['HLD-PPE-010','Fire-Resistant Gloves (Pair)','PPE / Safety Equipment',0,'Nos',15,350,'SafetyFirst Equipment','PPE Cabinet']
  ];
  samples.forEach(([sku,name,category,qty,unit,reorder,price,supplier,location])=>{
    if(state.items.some(i=> i.sku === sku)) return;
    const item = { id: uid('item'), sku, name, category, qty, unit, reorder, price, supplier, location, remarks:'',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    state.items.push(item);
    if(qty > 0) addLog(item,'IN',qty,qty,'Opening Stock (sample data)');
  });
  persist();
  renderDashboard();
  renderInventory();
  toast('Sample data loaded.');
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  if(!confirm('This will permanently delete ALL inventory items and log history from this browser. Continue?')) return;
  state.items = [];
  state.log = [];
  persist();
  renderDashboard();
  renderInventory();
  renderFullLog();
  toast('All data cleared.');
});

/* =========================================================
   CLOCK + INIT
   ========================================================= */
function tickClock(){
  document.getElementById('liveClock').textContent = new Date().toLocaleTimeString('en-IN', { hour12:false });
}
setInterval(tickClock, 1000);
tickClock();

populateCategoryDropdowns();
renderDashboard();
renderInventory();
