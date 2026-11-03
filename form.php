<?php
declare(strict_types=1);

/**
 * Обработчик формы заявки сайта FlyPlus.
 *
 * Для AJAX-запросов отвечает JSON, для обычного POST (без JS) — HTML-страницей.
 * Проверка на хостинге: php -l form.php
 */

// ===== НАСТРОЙКИ (ЗАМЕНИТЬ под себя) =====
$CONFIG = [
    'email'       => 'info@flyplus.ru', // ЗАМЕНИТЬ: рабочий ящик, который точно принимает почту
    'tg_token'    => '',                // опционально: токен Telegram-бота для мгновенных уведомлений
    'tg_chat_id'  => '',                // опционально: chat_id в Telegram
    'min_seconds' => 2,                 // антибот: минимум секунд от открытия страницы до отправки
    'cooldown'    => 60,                // антиспам: пауза между заявками (секунды)
];

$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH'])
    && strtolower((string) $_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

/**
 * Ответ клиенту: JSON для AJAX, простая HTML-страница для обычного POST.
 */
function respond(bool $ok, array $payload, int $status, bool $isAjax): void
{
    http_response_code($status);
    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    $head = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">'
          . '<meta name="viewport" content="width=device-width, initial-scale=1">';
    if ($ok) {
        echo $head . '<title>Заявка отправлена — FlyPlus</title></head>'
            . '<body style="font-family: sans-serif; max-width: 480px; margin: 60px auto; line-height: 1.6; padding: 0 20px;">'
            . '<h1>Заявка отправлена</h1>'
            . '<p>Спасибо! Мы перезвоним в рабочее время и поможем подобрать билеты, отель или тур.</p>'
            . '<p><a href="index.html">Вернуться на главную</a></p>'
            . '</body></html>';
    } else {
        $errors = isset($payload['errors']) && is_array($payload['errors'])
            ? implode(' ', $payload['errors'])
            : 'Проверьте, пожалуйста, форму.';
        echo $head . '<title>Не получилось отправить — FlyPlus</title></head>'
            . '<body style="font-family: sans-serif; max-width: 480px; margin: 60px auto; line-height: 1.6; padding: 0 20px;">'
            . '<h1>Не получилось отправить</h1>'
            . '<p>' . htmlspecialchars($errors, ENT_QUOTES, 'UTF-8') . '</p>'
            . '<p><a href="index.html#request">Попробовать снова</a></p>'
            . '</body></html>';
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(false, ['errors' => ['Неверный метод запроса.']], 405, $isAjax);
}

// Honeypot: бот заполнил скрытое поле — делаем вид, что отправилось, но не отправляем
if (!empty($_POST['website'])) {
    respond(true, ['ok' => true], 200, $isAjax);
}

// Антиспам: пауза между заявками в рамках сессии
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (isset($_SESSION['lead_last'])
    && (time() - (int) $_SESSION['lead_last']) < $CONFIG['cooldown']) {
    respond(false, ['errors' => ['Заявку уже отправляли. Подождите минуту и попробуйте снова.']], 429, $isAjax);
}

// Антибот: слишком быстрая отправка (поле ts ставит JS при открытии страницы;
// без JS поле пустое — проверка пропускается, honeypot и cooldown остаются)
$ts = (int) ($_POST['ts'] ?? 0);
if ($ts > 0 && (int) round(microtime(true) * 1000) - $ts < $CONFIG['min_seconds'] * 1000) {
    respond(false, ['errors' => ['Слишком быстро — проверьте, пожалуйста, данные и отправьте ещё раз.']], 422, $isAjax);
}

// Поля формы
$name     = trim((string) ($_POST['name'] ?? ''));
$phone    = trim((string) ($_POST['phone'] ?? ''));
$direction = mb_substr(trim((string) ($_POST['direction'] ?? '')), 0, 200, 'UTF-8');
$dates    = mb_substr(trim((string) ($_POST['dates'] ?? '')), 0, 200, 'UTF-8');
$consent  = $_POST['consent'] ?? '';

$errors = [];
if (mb_strlen($name, 'UTF-8') < 2 || mb_strlen($name, 'UTF-8') > 100) {
    $errors['name'] = 'Укажите имя (от 2 символов).';
}
$digits = preg_replace('/\D/', '', $phone);
if ($digits === null || (strlen($digits) !== 10 && strlen($digits) !== 11)) {
    $errors['phone'] = 'Укажите телефон (10-11 цифр).';
}
if ($consent !== '1') {
    $errors['consent'] = 'Нужно согласие на обработку персональных данных.';
}
if ($errors) {
    respond(false, ['errors' => $errors], 422, $isAjax);
}

// Письмо оператору
$subject = 'Заявка с сайта FlyPlus';
$body    = "Имя: {$name}\n"
         . "Телефон: {$phone}\n"
         . "Направление: {$direction}\n"
         . "Когда: {$dates}\n"
         . "IP: " . ($_SERVER['REMOTE_ADDR'] ?? '-') . "\n"
         . "Время: " . date('Y-m-d H:i:s') . "\n";
$headers = "Content-Type: text/plain; charset=UTF-8\r\n"
         . "From: FlyPlus <no-reply@flyplus.ru>\r\n";

$sent = false;
if (filter_var($CONFIG['email'], FILTER_VALIDATE_EMAIL)) {
    $sent = mail(
        $CONFIG['email'],
        '=?UTF-8?B?' . base64_encode($subject) . '?=',
        $body,
        $headers
    );
}

// Опционально: мгновенное уведомление в Telegram
if (!empty($CONFIG['tg_token']) && !empty($CONFIG['tg_chat_id'])) {
    $url = 'https://api.telegram.org/bot' . $CONFIG['tg_token'] . '/sendMessage';
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json\r\n",
            'content' => json_encode(
                ['chat_id' => $CONFIG['tg_chat_id'], 'text' => "Заявка FlyPlus\n{$body}"],
                JSON_UNESCAPED_UNICODE
            ),
            'timeout' => 5,
        ],
    ]);
    $tgResult = @file_get_contents($url, false, $ctx);
    if ($tgResult !== false) {
        $sent = true;
    }
}

$_SESSION['lead_last'] = time();

if (!$sent) {
    respond(false, ['errors' => ['Не удалось отправить заявку. Попробуйте позже — данные не потерялись.']], 500, $isAjax);
}

respond(true, ['ok' => true], 200, $isAjax);
