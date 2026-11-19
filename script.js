/* =========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   ทำงานตาม element ที่พบในแต่ละหน้า:
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================= */

var ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbzZtlirhRRnkO_-O1wQs34nSRS5mP-LMpk_S6_EtjhW8rSXRzbNTXGTCGql7I2bcUR1hw/exec';
var ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI30a9Gnko2r971ibjHLrKpqzpk8fR_LueJGQ3Q-2_5-WKkMJT-K309kUvR1n3jQHIkSccgLESPKRK/pub?gid=0&single=true&output=csv';

var MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------------------------------------------------------
   1) product.html — แสดงสินค้า + กรองตาม mood
   --------------------------------------------------------- */
function initProductPage() {
  var listEl = document.getElementById('product-list');
  var barEl = document.getElementById('filter-bar');
  var products = [];

  // อ่าน ?mood=xxx (ถ้าไม่ตรงกับ mood ที่มี ให้ใช้ "ทั้งหมด")
  var param = new URLSearchParams(window.location.search).get('mood');
  var currentMood = 'all';
  if (param) {
    param = param.toLowerCase();
    var found = MOODS.some(function (m) { return m.key === param; });
    if (found) currentMood = param;
  }

  function renderFilterBar() {
    if (!barEl) return;
    barEl.innerHTML = '';
    MOODS.forEach(function (m) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter__btn' + (m.key === currentMood ? ' is-active' : '');
      btn.textContent = m.label;
      btn.addEventListener('click', function () {
        currentMood = m.key;
        renderFilterBar();
        renderProducts();
      });
      barEl.appendChild(btn);
    });
  }

  function buildItemName(p) {
    return p.size ? p.name + ' ' + p.size : p.name;
  }

  function renderProducts() {
    listEl.innerHTML = '';
    var shown = products.filter(function (p) {
      return currentMood === 'all' || p.mood === currentMood;
    });

    if (shown.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'ไม่พบสินค้าในหมวดนี้';
      listEl.appendChild(empty);
      return;
    }

    shown.forEach(function (p) {
      var itemName = buildItemName(p);
      var orderUrl = 'order.html?item=' + encodeURIComponent(itemName) +
                     '&price=' + encodeURIComponent(p.price);

      var card = document.createElement('article');
      card.className = 'product-card';
      card.setAttribute('data-mood', p.mood);

      var img = document.createElement('img');
      img.className = 'product-card__image';
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';

      var body = document.createElement('div');
      body.className = 'product-card__body';

      var title = document.createElement('h3');
      title.className = 'product-card__name';
      var dot = document.createElement('span');
      dot.className = 'mood-dot';
      title.appendChild(dot);
      title.appendChild(document.createTextNode(p.name));

      var meta = document.createElement('p');
      meta.className = 'product-card__meta';
      meta.textContent = p.size ? p.size : 'โรลออน';

      var desc = document.createElement('p');
      desc.className = 'product-card__desc';
      desc.textContent = p.description || '';

      var footer = document.createElement('div');
      footer.className = 'product-card__footer';

      var price = document.createElement('span');
      price.className = 'price';
      price.textContent = Number(p.price).toLocaleString('th-TH');
      var unit = document.createElement('small');
      unit.textContent = 'บาท';
      price.appendChild(unit);

      var buy = document.createElement('a');
      buy.className = 'btn btn--small';
      buy.href = orderUrl;
      buy.textContent = 'สั่งซื้อ';

      footer.appendChild(price);
      footer.appendChild(buy);
      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(desc);
      body.appendChild(footer);
      card.appendChild(img);
      card.appendChild(body);
      listEl.appendChild(card);
    });
  }

  renderFilterBar();

  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      renderProducts();
    })
    .catch(function (error) {
      console.error(error);
      listEl.innerHTML = '';
      var msg = document.createElement('p');
      msg.className = 'muted';
      msg.textContent = 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง';
      listEl.appendChild(msg);
    });
}

/* ---------------------------------------------------------
   2) order.html — เติม item/price จาก URL + ส่งคำสั่งซื้อ
   --------------------------------------------------------- */
function initOrderPage() {
  var form = document.getElementById('orderForm');
  var params = new URLSearchParams(window.location.search);

  // เติมทั้งชื่อสินค้า (#items) และราคา (#total) ทันทีที่โหลดหน้า
  var itemParam = params.get('item');
  var priceParam = params.get('price');
  if (itemParam !== null) document.getElementById('items').value = itemParam;
  if (priceParam !== null) document.getElementById('total').value = priceParam;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ---------------------------------------------------------
   3) admin.html — ดึง CSV จาก Google Sheet แสดงเป็นตาราง
   --------------------------------------------------------- */

// parse CSV เอง: รองรับ "..." , "" (เครื่องหมายคำพูดซ้อน), คอมมาและขึ้นบรรทัดใหม่ในช่องข้อความ
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ตัด BOM

  for (var i = 0; i < text.length; i++) {
    var c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // ตัดแถวว่างทั้งแถว
  return rows.filter(function (r) {
    return r.some(function (cell) { return cell.trim() !== ''; });
  });
}

function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');

  function showMessage(text) {
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = text;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(ORDERS_CSV_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);

      // ถ้าแถวแรกเป็นหัวตาราง (ช่องวันเวลาไม่มีตัวเลขเลย) ให้ข้าม
      if (rows.length > 0 && !/\d/.test(rows[0][0] || '')) rows.shift();

      if (rows.length === 0) {
        showMessage('ยังไม่มีคำสั่งซื้อ');
        return;
      }

      // ชีตเพิ่มแถวต่อท้ายเสมอ จึงกลับลำดับให้รายการล่าสุดขึ้นก่อน
      rows.reverse();

      tbody.innerHTML = '';
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        for (var i = 0; i < 6; i++) {
          var td = document.createElement('td');
          td.textContent = r[i] !== undefined ? r[i] : ''; // textContent กัน HTML แทรกจากข้อมูลลูกค้า
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (error) {
      console.error(error);
      showMessage('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    });
}
