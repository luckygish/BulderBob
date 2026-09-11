extends Node

## Автобанк: читает состояние технологий ветки «Финансы» и ведёт кредиты.
## Без системы вкладов; кредиты игрока и ботов гасятся равными ежедневными долями.

## Доступные кредиты: сумма -> итоговая ставка за весь срок (не годовая).
const LOAN_OPTIONS: Dictionary = {
	"500000": {"amount": 500000, "rate": 0.15},
	"800000": {"amount": 800000, "rate": 0.17},
}
## Фиксированный срок погашения (в игровых днях).
const LOAN_TERM_DAYS: int = 10

## Активный кредит игрока; формат см. compute_loan(). Пустой {} — кредита нет.
var player_loan: Dictionary = {}


## Подписывается на смену дня для ежедневного погашения.
func _ready() -> void:
	Signals.day_changed.connect(_on_day_changed)


## Сбрасывает состояние банка (новая игра).
func reset() -> void:
	player_loan.clear()
	Signals.loan_state_changed.emit()


## Разблокирован ли банковский счёт.
func bank_unlocked() -> bool:
	return TechnologyManager.is_researched("bank_account")


## Скидка на лизинг (доля, 0..1).
func leasing_discount() -> float:
	return 0.05 if TechnologyManager.is_researched("good_leasing") else 0.0


## Аванс-доля бюджета при взятии заказа (факторинг).
func advance_payment() -> float:
	return 0.3 if TechnologyManager.is_researched("factoring") else 0.0


## Есть ли у игрока активный кредит.
func has_active_player_loan() -> bool:
	return not player_loan.is_empty()


## Причина, по которой нельзя взять кредит; пустая строка — можно.
func get_loan_block_reason() -> String:
	if not bank_unlocked():
		return "Кредит не доступен: изучите технологию «Банковский счет»"
	if has_active_player_loan():
		return "Уже есть активный кредит"
	return ""


## Итоговая сумма к возврату по кредиту (основная сумма + проценты).
func get_loan_total(amount: int) -> int:
	var rate: float = _get_loan_rate(amount)
	return roundi(float(amount) * (1.0 + rate))


## Ежедневный равный платёж по кредиту.
func get_loan_daily(amount: int) -> int:
	return roundi(float(get_loan_total(amount)) / float(LOAN_TERM_DAYS))


## Выдаёт разовую ставку по сумме кредита (0.0, если нет в справочнике).
func _get_loan_rate(amount: int) -> float:
	var opt: Dictionary = LOAN_OPTIONS.get(str(amount), {})
	return float(opt.get("rate", 0.0))


## Готовит запись кредита по сумме: {amount, rate, total, daily, remaining}.
func compute_loan(amount: int, days: int = LOAN_TERM_DAYS) -> Dictionary:
	var rate: float = _get_loan_rate(amount)
	var total: int = roundi(float(amount) * (1.0 + rate))
	var daily: int = roundi(float(total) / float(maxi(1, days)))
	return {
		"amount": amount,
		"rate": rate,
		"total": total,
		"daily": daily,
		"remaining": total,
	}


## Остаток погашения кредита игрока (0, если кредита нет).
func get_player_loan_remaining() -> int:
	return int(player_loan.get("remaining", 0))


## Ежедневный платёж игрока (0, если кредита нет).
func get_player_loan_daily() -> int:
	return int(player_loan.get("daily", 0))


## Число оставшихся дней погашения (0, если кредита нет).
func get_player_loan_days_left() -> int:
	var remaining: int = get_player_loan_remaining()
	var daily: int = get_player_loan_daily()
	if daily <= 0 or remaining <= 0:
		return 0
	return ceili(float(remaining) / float(daily))


## Игрок берёт кредит. Возвращает true при успехе.
func take_player_loan(amount: int) -> bool:
	if str(amount) not in LOAN_OPTIONS:
		return false
	if not get_loan_block_reason().is_empty():
		return false
	player_loan = compute_loan(amount)
	GameManager.earn(amount)
	Signals.journal_log("День %d · Кредит: +%s руб. под %.0f%% (%s руб. к возврату, %d дн.)." % [
		GameManager.day, _format_num(amount), float(player_loan["rate"]) * 100.0,
		_format_num(int(player_loan["total"])), get_player_loan_days_left(),
	])
	Signals.loan_state_changed.emit()
	return true


## Ежедневный платёж игрока по кредиту.
func _on_day_changed(_day: int) -> void:
	if not has_active_player_loan():
		return
	var pay: int = mini(int(player_loan["daily"]), int(player_loan["remaining"]))
	pay = min(pay, GameManager.money)
	if pay > 0:
		GameManager.spend(pay)
	player_loan["remaining"] = int(player_loan["remaining"]) - pay
	if int(player_loan["remaining"]) <= 0:
		var total: int = int(player_loan["total"])
		player_loan = {}
		Signals.journal_log("День %d · Кредит погашен: %s руб." % [GameManager.day, _format_num(total)])
	Signals.loan_state_changed.emit()


## Форматирует число с разделителями тысяч.
func _format_num(value: int) -> String:
	var s := str(value)
	var result := ""
	var count := 0
	for i in range(s.length() - 1, -1, -1):
		if count > 0 and count % 3 == 0:
			result = " " + result
		result = s[i] + result
		count += 1
	return result