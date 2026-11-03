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

  // Отправка формы заявки: AJAX, с fallback на обычный POST
  const form = document.getElementById('lead-form');
  if (form) {
    const errorsBox = document.getElementById('lead-form-errors');
    const submitBtn = form.querySelector('.lead-form__submit');
    const nameInput = form.querySelector('[name="name"]');
    const phoneInput = form.querySelector('[name="phone"]');
    const consentInput = form.querySelector('[name="consent"]');

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
      const errors = validate();
      if (errors.length) {
        showErrors(errors);
        return;
      }
      if (errorsBox) errorsBox.hidden = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправляем…';
      }

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        const data = await res.json();
        if (data.ok) {
          trackGoal('lead_form');
          form.innerHTML =
            '<div class="lead-form__success" role="status">' +
            '<strong>Заявка отправлена</strong>' +
            '<span>Спасибо! Мы перезвоним в рабочее время и поможем подобрать вариант.</span>' +
            '</div>';
        } else {
          const msgs = data.errors
            ? Object.values(data.errors)
            : ['Не удалось отправить. Попробуйте позже.'];
          showErrors(msgs);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить заявку';
          }
        }
      } catch (err) {
        // Ответ не пришёл (сеть/хостинг) — обычный POST на form.php
        form.submit();
      }
    });
  }
});
