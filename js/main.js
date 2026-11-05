// Цель Яндекс.Метрики: срабатывает только при подставленном числовом ID
function trackGoal(goal) {
  if (typeof ym === 'function' && /^\d+$/.test(String(window.YM_ID || ''))) {
    ym(window.YM_ID, 'reachGoal', goal);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Мобильное меню
  const burger = document.querySelector('.burger');
  const nav = document.getElementById('main-nav');
  if (burger && nav) {
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };
    burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') &&
          !e.target.closest('.nav') &&
          !e.target.closest('.burger')) {
        setOpen(false);
      }
    });
  }

  // Время открытия страницы — для антибот-проверки скорости заполнения
  const tsField = document.getElementById('lf-ts');
  if (tsField) tsField.value = String(Date.now());

  // Отправка формы заявки: на внешний обработчик (LEAD_CONFIG.endpoint), без PHP
  const form = document.getElementById('lead-form');
  if (form) {
    const errorsBox = document.getElementById('lead-form-errors');
    const submitBtn = form.querySelector('.lead-form__submit');
    const nameInput = form.querySelector('[name="name"]');
    const phoneInput = form.querySelector('[name="phone"]');
    const consentInput = form.querySelector('[name="consent"]');

    // Внешний обработчик заявок (сайт статический, PHP не используется)
    const leadCfg = window.LEAD_CONFIG || {};
    const leadEndpoint = typeof leadCfg.endpoint === 'string' ? leadCfg.endpoint.trim() : '';
    const leadReady = /^https?:\/\//.test(leadEndpoint) && leadEndpoint.indexOf('ЗАМЕНИТЬ') === -1;

    const fakeSuccess = () => {
      if (form.dataset.lfDone === '1') return;
      form.dataset.lfDone = '1';
      trackGoal('lead_form');
      form.innerHTML =
        '<div class="lead-form__success" role="status">' +
        '<strong>Заявка отправлена</strong>' +
        '<span>Спасибо! Мы перезвоним в рабочее время и поможем подобрать вариант.</span>' +
        '</div>';
    };

    const setInvalid = (el, invalid) => {
      if (el) el.classList.toggle('is-invalid', invalid);
    };

    const validate = () => {
      const errors = [];
      const nameOk = nameInput && nameInput.value.trim().length >= 2;
      setInvalid(nameInput, !nameOk);
      if (!nameOk) errors.push('Укажите имя.');

      const digits = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
      const phoneOk = digits.length === 10 || digits.length === 11;
      setInvalid(phoneInput, !phoneOk);
      if (!phoneOk) errors.push('Укажите телефон (10-11 цифр).');

      if (!consentInput || !consentInput.checked) {
        errors.push('Нужно согласие на обработку данных.');
      }
      return errors;
    };

    const showErrors = (messages) => {
      if (errorsBox) {
        errorsBox.hidden = false;
        errorsBox.textContent = messages.join(' ');
      }
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Антибот: honeypot заполнен либо отправка быстрее 3 с после загрузки —
      // роботам показываем «успех» (реальные люди не успевают: форма ниже
      // по потоку на тысячи пикселей скролла).
      const hp = form.querySelector('[name="website"]');
      const tsNow = document.getElementById('lf-ts');
      const elapsed = tsNow ? Date.now() - Number(tsNow.value || 0) : 9999;
      if ((hp && hp.value) || elapsed < 3000) {
        fakeSuccess();
        return;
      }

      const errors = validate();
      if (errors.length) {
        showErrors(errors);
        return;
      }
      if (errorsBox) errorsBox.hidden = true;

      if (!leadReady) {
        showErrors(['Не удалось отправить: канал связи пока не настроен. Попробуйте позже.']);
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправляем…';
      }

      try {
        const payload = {};
        new FormData(form).forEach((value, key) => {
          if (key !== 'website') payload[key] = value;
        });
        payload.page = location.href;
        // text/plain — «простой» запрос без CORS-preflight (работает с Google
        // Apps Script и большинством вебхуков); тело — JSON.
        const res = await fetch(leadEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        let data = null;
        try { data = await res.json(); } catch (parseErr) { data = null; }
        if (res.ok && (!data || data.ok !== false)) {
          fakeSuccess();
        } else {
          const msgs = data && data.errors
            ? Object.values(data.errors)
            : ['Не удалось отправить. Попробуйте позже.'];
          showErrors(msgs);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить заявку';
          }
        }
      } catch (err) {
        showErrors(['Не удалось отправить. Проверьте соединение и попробуйте ещё раз.']);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Отправить заявку';
        }
      }
    });
  }
});
