(function () {
  'use strict';

  const token = localStorage.getItem('token');
  const roles = {
    admin: 'System Administrator',
    moderators: ['System Administrator', 'Librarian', 'Content Manager'],
  };
  const state = {
    user: null,
    usersPage: 1,
    moderationPage: 1,
    editingCategory: null,
    moderationAction: null,
  };
  const $ = id => document.getElementById(id);

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function authHeaders() {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function setMessage(element, message, tone) {
    element.textContent = message || '';
    if (tone) element.dataset.tone = tone;
    else delete element.dataset.tone;
  }

  function formatDate(value) {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  }

  function formatBytes(value) {
    if (!Number.isFinite(Number(value)) || Number(value) < 1) return 'Size unavailable';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = Number(value);
    let index = 0;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
    return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  async function api(path, options) {
    let response;
    try {
      response = await fetch(path, {
        ...options,
        headers: { ...authHeaders(), ...(options && options.headers ? options.headers : {}) },
      });
    } catch (error) {
      throw new Error('Unable to reach LibraHub. Check your connection and try again.');
    }
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.href = 'login.html';
      throw new Error('Your session has expired. Please sign in again.');
    }
    if (!response.ok) {
      const message = response.status === 403 ? 'You are not authorized for this action.'
        : response.status === 404 ? 'The requested record was not found.'
          : response.status === 409 ? (payload.message || 'This change conflicts with existing catalogue data.')
            : response.status === 422 || response.status === 400 ? (payload.message || 'Please check the submitted information.')
              : 'The request could not be completed.';
      throw new Error(message);
    }
    return payload;
  }

  function updateProfile(user) {
    const profile = $('adminProfile');
    profile.replaceChildren();
    const dot = node('span', '', 'status-dot');
    dot.setAttribute('aria-hidden', 'true');
    const details = node('div');
    details.append(node('strong', user.name || 'LibraHub staff'), node('span', user.role || 'Authorized staff'));
    profile.append(dot, details);
    $('adminNavLink').hidden = false;
    const loginLink = $('loginLink');
    const registerLink = $('registerLink');
    loginLink.textContent = 'Sign out';
    loginLink.href = '#';
    loginLink.addEventListener('click', event => {
      event.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.href = 'index.html';
    });
    registerLink.hidden = true;
  }

  function showAccessDenied(message) {
    $('workspace').hidden = true;
    $('accessDenied').hidden = false;
    $('accessDeniedMessage').textContent = message;
  }

  function emptyState(title, message) {
    const wrapper = node('div', '', 'empty-state');
    wrapper.append(node('h3', title), node('p', message));
    return wrapper;
  }

  function renderPagination(container, pagination, page, onChange) {
    container.replaceChildren();
    if (!pagination || pagination.pages < 2) { container.hidden = true; return; }
    container.hidden = false;
    const previous = node('button', 'Previous', 'button secondary');
    previous.type = 'button'; previous.disabled = page <= 1;
    previous.addEventListener('click', () => onChange(page - 1));
    const label = node('span', `Page ${page} of ${pagination.pages}`);
    const next = node('button', 'Next', 'button secondary');
    next.type = 'button'; next.disabled = page >= pagination.pages;
    next.addEventListener('click', () => onChange(page + 1));
    container.append(previous, label, next);
  }

  function renderUsers(users) {
    const list = $('usersList');
    list.replaceChildren();
    if (!users.length) { list.append(emptyState('No users found', 'Try a different search or filter combination.')); return; }
    users.forEach(user => {
      const card = node('article', '', 'record-card');
      const main = node('div', '', 'record-main');
      main.append(node('h3', user.name || 'Unnamed user', 'record-title'), node('p', user.email || 'Email unavailable', 'record-subtitle'));
      const meta = node('div', '', 'record-meta');
      meta.append(node('span', user.role || 'Role unavailable', 'badge'));
      meta.append(node('span', user.is_active === false ? 'Inactive' : 'Active', user.is_active === false ? 'badge inactive' : 'badge'));
      meta.append(node('span', `Joined ${formatDate(user.createdAt)}`));
      main.append(meta);
      const actions = node('div', '', 'record-actions');
      const isSelf = String(user.id) === String(state.user.id);
      const roleSelect = document.createElement('select');
      roleSelect.setAttribute('aria-label', `Change role for ${user.name}`);
      ['Reader/Student', 'Author', 'Librarian', 'Content Manager', 'System Administrator'].forEach(role => {
        const option = node('option', role); option.value = role; option.selected = role === user.role; roleSelect.append(option);
      });
      roleSelect.disabled = isSelf;
      roleSelect.addEventListener('change', () => changeRole(user, roleSelect));
      actions.append(roleSelect);
      const status = node('button', user.is_active === false ? 'Activate' : 'Deactivate', 'button secondary');
      status.type = 'button'; status.disabled = isSelf;
      status.addEventListener('click', () => changeStatus(user, status));
      actions.append(status);
      card.append(main, actions);
      list.append(card);
    });
  }

  async function loadUsers(page = state.usersPage) {
    state.usersPage = page;
    const message = $('usersMessage');
    setMessage(message, 'Loading users…');
    $('refreshUsers').disabled = true;
    const query = new URLSearchParams({ page: String(page), limit: '12' });
    const search = $('userSearch').value.trim();
    const role = $('userRole').value;
    const active = $('userStatus').value;
    if (search) query.set('search', search);
    if (role) query.set('role', role);
    if (active) query.set('active', active);
    try {
      const payload = await api(`/api/users?${query}`);
      renderUsers(payload.data || []);
      $('userCount').textContent = String(payload.pagination?.total ?? payload.data?.length ?? 0);
      renderPagination($('usersPagination'), payload.pagination, page, loadUsers);
      setMessage(message, payload.data?.length ? '' : 'No accounts match the current filters.');
    } catch (error) { setMessage(message, error.message, 'error'); }
    finally { $('refreshUsers').disabled = false; }
  }

  async function changeRole(user, select) {
    const nextRole = select.value;
    if (!window.confirm(`Change ${user.name || 'this user'} to ${nextRole}?`)) { select.value = user.role; return; }
    select.disabled = true;
    try { await api(`/api/users/${encodeURIComponent(user.id)}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleName: nextRole }) }); setMessage($('usersMessage'), 'Role updated.', 'success'); await loadUsers(state.usersPage); }
    catch (error) { select.value = user.role; setMessage($('usersMessage'), error.message, 'error'); }
    finally { select.disabled = false; }
  }

  async function changeStatus(user, button) {
    const nextStatus = user.is_active === false;
    if (!window.confirm(`${nextStatus ? 'Activate' : 'Deactivate'} ${user.name || 'this user'}?`)) return;
    button.disabled = true;
    try { await api(`/api/users/${encodeURIComponent(user.id)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: nextStatus }) }); setMessage($('usersMessage'), 'Account status updated.', 'success'); await loadUsers(state.usersPage); }
    catch (error) { setMessage($('usersMessage'), error.message, 'error'); button.disabled = false; }
  }

  function renderModeration(books) {
    const list = $('moderationList'); list.replaceChildren();
    if (!books.length) { list.append(emptyState('The review queue is clear', 'New submissions will appear here when authors send them in.')); return; }
    books.forEach(book => {
      const card = node('article', '', 'record-card');
      const main = node('div', '', 'record-main');
      main.append(node('h3', book.title || 'Untitled submission', 'record-title'));
      main.append(node('p', `By ${book.author?.name || 'Unknown author'}`, 'record-subtitle'));
      const meta = node('div', '', 'record-meta');
      meta.append(node('span', book.category?.category_name || 'Category unavailable'));
      meta.append(node('span', `Submitted ${formatDate(book.createdAt)}`));
      meta.append(node('span', `${String(book.file_type || 'file').toUpperCase()} · ${formatBytes(book.file_size)}`));
      main.append(meta);
      const actions = node('div', '', 'record-actions');
      const view = node('button', 'View details', 'button secondary'); view.type = 'button'; view.addEventListener('click', () => openBookDetails(book));
      const approve = node('button', 'Approve', 'button'); approve.type = 'button'; approve.addEventListener('click', () => openModerationDialog(book, 'approved'));
      const reject = node('button', 'Reject', 'button secondary'); reject.type = 'button'; reject.addEventListener('click', () => openModerationDialog(book, 'rejected'));
      actions.append(view, approve, reject); card.append(main, actions); list.append(card);
    });
  }

  function openBookDetails(book) {
    const content = $('bookDetailsContent');
    content.replaceChildren();
    [['Title', book.title || 'Untitled submission'], ['Author', book.author?.name || 'Unknown author'], ['Category', book.category?.category_name || 'Category unavailable'], ['Submitted', formatDate(book.createdAt)], ['File', `${String(book.file_type || 'file').toUpperCase()} · ${formatBytes(book.file_size)}`], ['Description', book.description || 'No description provided.']].forEach(([label, value]) => {
      const item = document.createElement('div');
      const term = node('dt', label);
      const detail = node('dd', value);
      item.append(term, detail);
      content.append(item);
    });
    $('bookDetailsDialog').showModal();
  }

  async function loadModeration(page = state.moderationPage) {
    state.moderationPage = page;
    const message = $('moderationMessage'); setMessage(message, 'Loading review queue…'); $('refreshModeration').disabled = true;
    const query = new URLSearchParams({ page: String(page), limit: '12' });
    const search = $('moderationSearch').value.trim(); const author = $('moderationAuthor').value.trim();
    if (search) query.set('search', search); if (author) query.set('author', author);
    try {
      const payload = await api(`/api/books/moderation/pending?${query}`); renderModeration(payload.data || []);
      $('pendingCount').textContent = String(payload.pagination?.total ?? payload.data?.length ?? 0);
      renderPagination($('moderationPagination'), payload.pagination, page, loadModeration);
      setMessage(message, payload.data?.length ? '' : 'No pending submissions match the current filters.');
    } catch (error) { setMessage(message, error.message, 'error'); }
    finally { $('refreshModeration').disabled = false; }
  }

  function openModerationDialog(book, action) {
    state.moderationAction = { id: book._id, action };
    $('moderationDialogTitle').textContent = action === 'rejected' ? 'Reject submission' : 'Approve submission';
    $('moderationDialogBook').textContent = book.title || 'Untitled submission';
    $('rejectionReasonField').hidden = action !== 'rejected'; $('rejectionReason').value = ''; setMessage($('moderationDialogMessage'), '');
    $('confirmModeration').textContent = action === 'rejected' ? 'Reject book' : 'Approve book';
    $('moderationDialog').showModal();
  }

  async function submitModeration(event) {
    event.preventDefault();
    if (event.submitter && event.submitter.value === 'cancel') { $('moderationDialog').close(); return; }
    if (!state.moderationAction) return;
    const { id, action } = state.moderationAction;
    const reason = $('rejectionReason').value.trim();
    if (action === 'rejected' && !reason) { setMessage($('moderationDialogMessage'), 'A rejection reason is required.', 'error'); return; }
    $('confirmModeration').disabled = true;
    try {
      await api(`/api/books/${encodeURIComponent(id)}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: action, ...(action === 'rejected' ? { rejection_reason: reason } : {}) }) });
      $('moderationDialog').close(); setMessage($('moderationMessage'), action === 'rejected' ? 'Book rejected.' : 'Book approved.', 'success'); await loadModeration(state.moderationPage);
    } catch (error) { setMessage($('moderationDialogMessage'), error.message, 'error'); }
    finally { $('confirmModeration').disabled = false; }
  }

  function renderCategories(categories) {
    const list = $('categoriesList'); list.replaceChildren(); $('categoryCount').textContent = String(categories.length);
    if (!categories.length) { list.append(emptyState('No categories yet', 'Create the first topic for the catalogue.')); return; }
    categories.forEach(category => {
      const card = node('article', '', 'category-card'); card.append(node('h3', category.category_name)); card.append(node('p', category.description || 'No description provided.'));
      const actions = node('div', '', 'record-actions');
      const edit = node('button', 'Edit', 'button secondary'); edit.type = 'button'; edit.addEventListener('click', () => openCategoryDialog(category)); actions.append(edit);
      if (state.user.role === roles.admin) { const remove = node('button', 'Delete', 'button secondary'); remove.type = 'button'; remove.addEventListener('click', () => deleteCategory(category)); actions.append(remove); }
      card.append(actions); list.append(card);
    });
  }

  async function loadCategories() {
    const message = $('categoriesMessage'); setMessage(message, 'Loading categories…'); $('newCategory').disabled = true;
    try { const payload = await api('/api/categories'); renderCategories(payload.data || []); setMessage(message, ''); }
    catch (error) { setMessage(message, error.message, 'error'); }
    finally { $('newCategory').disabled = false; }
  }

  function openCategoryDialog(category) {
    state.editingCategory = category || null; $('categoryDialogTitle').textContent = category ? 'Edit category' : 'Add category'; $('categoryName').value = category?.category_name || ''; $('categoryDescription').value = category?.description || ''; setMessage($('categoryDialogMessage'), ''); $('categoryDialog').showModal();
  }

  async function submitCategory(event) {
    event.preventDefault();
    if (event.submitter && event.submitter.value === 'cancel') { $('categoryDialog').close(); return; }
    const name = $('categoryName').value.trim(); const description = $('categoryDescription').value.trim();
    if (!name) { setMessage($('categoryDialogMessage'), 'Category name is required.', 'error'); return; }
    const button = $('saveCategory'); button.disabled = true;
    const editing = state.editingCategory;
    try {
      await api(editing ? `/api/categories/${encodeURIComponent(editing._id)}` : '/api/categories', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category_name: name, description }) });
      $('categoryDialog').close(); setMessage($('categoriesMessage'), editing ? 'Category updated.' : 'Category created.', 'success'); await loadCategories();
    } catch (error) { setMessage($('categoryDialogMessage'), error.message, 'error'); }
    finally { button.disabled = false; }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete ${category.category_name}? This cannot be undone.`)) return;
    try { await api(`/api/categories/${encodeURIComponent(category._id)}`, { method: 'DELETE' }); setMessage($('categoriesMessage'), 'Category deleted.', 'success'); await loadCategories(); }
    catch (error) { setMessage($('categoriesMessage'), error.message, 'error'); }
  }

  function setupNavigation() {
    const menu = $('menuButton'); const links = $('navLinks');
    menu.addEventListener('click', () => { const open = links.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); });
  }

  function setupTabs() {
    const tabs = [['moderationTab', 'moderationPanel'], ['usersTab', 'usersPanel'], ['categoriesTab', 'categoriesPanel']];
    tabs.forEach(([tabId, panelId]) => $(tabId).addEventListener('click', () => {
      tabs.forEach(([otherTab, otherPanel]) => { const active = otherTab === tabId; $(otherTab).classList.toggle('active', active); $(otherTab).setAttribute('aria-selected', String(active)); $(otherPanel).hidden = !active; });
    }));
  }

  function setupEvents() {
    $('userFilters').addEventListener('submit', event => { event.preventDefault(); loadUsers(1); });
    $('moderationFilters').addEventListener('submit', event => { event.preventDefault(); loadModeration(1); });
    $('refreshUsers').addEventListener('click', () => loadUsers(state.usersPage)); $('refreshModeration').addEventListener('click', () => loadModeration(state.moderationPage)); $('newCategory').addEventListener('click', () => openCategoryDialog());
    $('moderationForm').addEventListener('submit', submitModeration); $('categoryForm').addEventListener('submit', submitCategory);
  }

  async function init() {
    setupNavigation(); setupTabs(); setupEvents();
    if (!token) { location.href = 'login.html'; return; }
    try {
      const payload = await api('/api/auth/me'); state.user = payload.user;
      const role = state.user.role;
      if (!roles.moderators.includes(role)) { showAccessDenied('Your current role does not include management permissions.'); return; }
      updateProfile(state.user); $('workspace').hidden = false;
      $('usersTab').hidden = role !== roles.admin;
      await Promise.all([loadModeration(), loadCategories(), role === roles.admin ? loadUsers() : Promise.resolve()]);
    } catch (error) {
      if (error.message.includes('session has expired')) return;
      showAccessDenied(error.message);
    }
  }

  init();
}());
