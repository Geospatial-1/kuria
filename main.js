// main.js (module)
import { auth, db, storage } from './firebase-init.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

// DOM refs
const authForm = document.getElementById('authForm');
const joinForm = document.getElementById('joinForm');
const resourceRequest = document.getElementById('resourceRequest');
const criticForm = document.getElementById('criticForm');
const criticFiles = document.getElementById('criticFiles');
const commentsList = document.getElementById('commentsList');
const resourcesTable = document.getElementById('resourcesTable');
const btnLogin = document.getElementById('btn-login');
const btnJoin = document.getElementById('btn-join');
const btnGoogle = document.getElementById('btn-google');
const btnLogout = document.getElementById('btn-logout');
const themeBtn = document.getElementById('themeToggle');

// Auth handlers
authForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(authForm);
  try {
    await signInWithEmailAndPassword(auth, f.get('email'), f.get('password'));
    alert('Logged in');
    // close offcanvas if open
    const off = bootstrap.Offcanvas.getInstance(document.getElementById('authPanel'));
    if (off) off.hide();
  } catch (err) {
    alert('Login failed: ' + err.message);
  }
});

document.getElementById('btn-register')?.addEventListener('click', async () => {
  const f = new FormData(authForm);
  try {
    await createUserWithEmailAndPassword(auth, f.get('email'), f.get('password'));
    alert('Registered');
  } catch (e) { alert(e.message); }
});

btnGoogle?.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try { await signInWithPopup(auth, provider); alert('Google login success'); } catch (e) { alert(e.message); }
});

btnLogout?.addEventListener('click', async () => { await signOut(auth); alert('Logged out'); });

onAuthStateChanged(auth, user => {
  if (user) {
    btnLogout.style.display = 'inline-block';
    if (btnGoogle) btnGoogle.style.display = 'none';
    btnLogin.textContent = user.displayName || user.email.split('@')[0];
  } else {
    if (btnLogout) btnLogout.style.display = 'none';
    if (btnGoogle) btnGoogle.style.display = 'inline-block';
    btnLogin.textContent = 'Login';
  }
});

// Join form -> registrations collection
joinForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(joinForm);
  try {
    await addDoc(collection(db, 'registrations'), {
      name: f.get('name'),
      email: f.get('email'),
      phone: f.get('phone'),
      type: f.get('type'),
      createdAt: new Date().toISOString()
    });
    alert('Registration request submitted');
    joinForm.reset();
  } catch (err) { alert('Submit failed: ' + err.message); }
});

// resourceRequest -> resourceRequests collection
resourceRequest?.addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(resourceRequest);
  try {
    await addDoc(collection(db, 'resourceRequests'), {
      name: f.get('rname'),
      email: f.get('remail'),
      desc: f.get('rdesc'),
      ts: new Date().toISOString()
    });
    alert('Request sent');
    resourceRequest.reset();
  } catch (err) { alert('Request failed: ' + err.message); }
});

// criticForm -> upload images then create post in 'posts' collection
criticForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(criticForm);
  const title = f.get('title'); const body = f.get('body'); const verdict = f.get('verdict');
  try {
    // require auth for critics (as requested)
    if (!auth.currentUser) { alert('Please login to submit as a registered critic'); return; }

    const files = criticFiles?.files;
    const imageUrls = await uploadImages(files, `critics/${auth.currentUser.uid}`);
    // store post
    await addDoc(collection(db, 'posts'), {
      title, body, verdict, images: imageUrls, author: auth.currentUser.uid, status: 'pending', createdAt: new Date().toISOString()
    });
    alert('Analysis submitted for admin approval');
    criticForm.reset();
  } catch (err) { alert('Submit failed: ' + err.message); }
});

// uploadImages helper (max 3, validate type and size <5MB)
async function uploadImages(files, pathPrefix = 'critics') {
  if (!files || files.length === 0) return [];
  const arr = Array.from(files).slice(0, 3);
  const uploaded = [];
  for (const file of arr) {
    if (!/image\/(png|jpeg|jpg)/.test(file.type)) throw new Error('Only PNG/JPEG allowed');
    if (file.size > 5 * 1024 * 1024) throw new Error('Max image size 5 MB');
    const r = storageRef(storage, `${pathPrefix}/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(r, file);
    const url = await getDownloadURL(snap.ref);
    uploaded.push(url);
  }
  return uploaded;
}

// load demo resources into table
function loadResources() {
  const demo = [
    { name: 'Community Feedback Form', desc: 'Submit feedback', url: 'https://example.com/sample.pdf' },
    { name: 'Grant Application', desc: 'Funding request template', url: 'https://example.com/sample2.pdf' }
  ];
  demo.forEach(r => {
    resourcesTable.insertAdjacentHTML('beforeend', `<tr><td>${r.name}</td><td>${r.desc}</td><td><a href="${r.url}" target="_blank">Open</a></td></tr>`);
  });
}
loadResources();

// comments live listener (demo)
try {
  const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    commentsList.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      commentsList.insertAdjacentHTML('beforeend', `<div class="mb-3 comment"><div class="d-flex justify-content-between"><strong>${d.name}</strong><small class="text-muted">${new Date(d.createdAt).toLocaleString()}</small></div><p>${d.text}</p></div>`);
    });
  });
} catch (e) { console.debug('comments snapshot disabled in demo', e.message); }

// Carousel auto scroll (start cycling and pause on hover)
(function carouselAuto() {
  const carouselEl = document.getElementById('eventsCarousel');
  if (!carouselEl) return;
  const bs = bootstrap.Carousel.getOrCreateInstance(carouselEl, { interval: 4000, ride: false });
  carouselEl.addEventListener('mouseenter', () => bs.pause());
  carouselEl.addEventListener('mouseleave', () => bs.cycle());
  bs.cycle();
})();

// Navbar auto-hide: when clicking outside navbar, collapse it if open
document.addEventListener('click', (e) => {
  const navCollapsed = document.querySelector('.navbar-collapse');
  if (navCollapsed && navCollapsed.classList.contains('show')) {
    const isNav = e.target.closest('.navbar');
    if (!isNav) {
      const bsCollapse = bootstrap.Collapse.getOrCreateInstance(navCollapsed);
      bsCollapse.hide();
    }
  }
});

// Theme toggle
themeBtn?.addEventListener('click', () => {
  const root = document.body;
  const t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', t);
  themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', t);
});
const saved = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', saved);
themeBtn && (themeBtn.textContent = saved === 'dark' ? '☀️' : '🌙');

// Module modal content (SPA)
window.openModule = (id) => {
  const titleMap = {
    'on-program': 'On-Program (Notifications & Voting)',
    'what-we-know': 'What we know (Reviews & Ratings)',
    'critics': 'Registered Critics (Post analysis)',
    'be-heard': 'Be heard (Comments & Threads)',
    'news': 'News & Updates',
    'events': 'Upcoming Events',
    'resources': 'Important Resources'
  };
  document.getElementById('moduleTitle').textContent = titleMap[id] || 'Module';
  const body = {
    'on-program': `<h3>On-Program</h3><p>This section lists current government programmes. Visitors can vote and prioritise projects. Voting requires a registered account.</p><p><strong>Terms:</strong> Only verified items are shown after admin approval.</p>`,
    'what-we-know': `<h3>What we know</h3><p>Here readers post verified reviews of ongoing projects. You can rate, comment and attach evidence.</p>`,
    'critics': `<h3>What Critics Say</h3><p>Registered critics can write objective analyses, attach up to 3 images (png/jpg). Attachments are stored as external links. The author must choose "Criticize" or "Approve".</p>`,
    'be-heard': `<h3>Be Heard</h3><p>Listeners can comment and start threads. Login requires name, email and phone. Replies create threaded conversations. Admin can hide or delete content if it breaches standards.</p>`,
    'news': `<h3>News & Updates</h3><p>Admins approve author posts. Visitors can like, comment and share (URL/Facebook/WhatsApp/email).</p>`,
    'events': `<h3>Events</h3><p>Upcoming meetings and engagements. RSVP through this module.</p>`,
    'resources': `<h3>Important resources</h3><p>PDFs and forms are linked externally. Visitors can request resources via a form.</p>`
  };
  document.getElementById('moduleBody').innerHTML = body[id] || '<p>Not available</p>';
  const modal = new bootstrap.Modal(document.getElementById('moduleModal'));
  modal.show();
};

// set current year
document.getElementById('year').textContent = new Date().getFullYear();
