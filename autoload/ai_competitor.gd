extends Node

## Менеджер ботов-строителей: три конкурирующих компании.
##
## Каждый бот самостоятельно берёт заказы с общей доски, нанимает рабочих из
## общего пула HR, покупает материалы на общем рынке (Market.ai_buy) и строит
## по дням. Накапливает прибыль («копилка») и действует активнее при росте
## капитала. Вызывается из Market._on_day_changed ДО вечерней поставки.

const BOT_BALANCE: Dictionary = {
	"bot_count": 3,
	"start_budget": 2_000_000,
	"max_crew": 2,
	"wage_work_hours_per_day": 8,
	"rental_cost_per_day": 5_000,
	"cooldown_min": 2,
	"cooldown_max": 4,
	"est_wage_per_man_hour": 150,
	"buy_ratio_good": 0.95,
	"buy_ratio_max": 1.10,
	"emergency_premium_ratio": 1.25,
	"max_material_budget_share": 0.85,
	"startup_strategy_order": [Bot.Strategy.AGGRESSIVE, Bot.Strategy.MODERATE, Bot.Strategy.CONSERVATIVE],
	## Веса стратегии: масссивы индексируются Bot.Strategy (0 агр./1 умер./2 конс.).
	"profit_w": [1.0, 1.0, 1.0],
	"speed_w": [0.3, 0.6, 1.0],
	"budget_w": [0.25, 0.05, 0.0],
}

var bots: Array[Bot] = []


## Инициализирует менеджер и подписывается на сигналы.
func _ready() -> void:
	reset()
	Signals.day_changed.connect(_on_day_changed)


## Создаёт ботов с бюджетом и старшими людьми. Не трогает общих рабочих.
func reset() -> void:
	bots.clear()
	var start_budget: int = int(BOT_BALANCE.get("start_budget", 1_200_000))
	var order: Array = BOT_BALANCE.get("startup_strategy_order", [])
	for i in int(BOT_BALANCE.get("bot_count", 3)):
		var strategy: int = int(order[i % order.size()]) if not order.is_empty() else Bot.Strategy.MODERATE
		var bot := Bot.new(_bot_name(i), strategy)
		bot.money = start_budget
		bot.loan = {}
		bots.append(bot)
	Signals.bots_updated.emit()


## Имя бота по индексу.
func _bot_name(i: int) -> String:
	var names: Array[String] = ["СтройГрад", "ДомМастер", "АтлантСтрой"]
	return names[i % names.size()]


## Реагирует на смену дня — забирает заказы вручную (см. bots_daily_tick).
func _on_day_changed(_current_day: int) -> void:
	pass


## Ежедневный ход всех ботов (вызывается из Market до поставки).
## Порядок обхода сдвигается каждый день, чтобы никто не голодал по ресурсам.
func bots_daily_tick(current_day: int) -> void:
	var n: int = bots.size()
	var start: int = current_day % n if n > 0 else 0
	for k in n:
		_tick_bot(bots[(start + k) % n])
	Signals.bots_updated.emit()


## Один проход жизненного цикла бота за день.
func _tick_bot(bot: Bot) -> void:
	if bot.state == Bot.State.COOLDOWN:
		bot.cooldown_days -= 1
		if bot.cooldown_days <= 0:
			bot.state = Bot.State.IDLE
		return

	if bot.has_loan():
		_pay_loan(bot)

	if bot.state == Bot.State.IDLE:
		_pick_job(bot)

	if bot.state != Bot.State.WORKING or bot.project == null:
		return

	# Страховка от «зависания»: без средств, без бригады и без материалов — бросаем.
	if bot.is_bankrupt() and bot.has_no_crew() and bot.has_missing_materials():
		bot.project = null
		bot.state = Bot.State.IDLE
		return

	_take_loan_if_stuck(bot)
	_hire_workers(bot)
	_stock_materials(bot)
	_build_day(bot)

	if bot.project.is_complete():
		_deliver(bot)


## Выбор заказа для свободного бота по стратегии.
func _pick_job(bot: Bot) -> void:
	var best_job: Job = null
	var best_index: int = -1
	var best_estimate: Dictionary = {}
	var best_score: float = -INF
	var jobs: Array[Job] = JobBoard.available_jobs
	var material_budget_share: float = float(BOT_BALANCE.get("max_material_budget_share", 0.85))
	for i in jobs.size():
		var job: Job = jobs[i]
		var estimate: Dictionary = _estimate(job)
		if int(estimate["margin"]) <= 0:
			continue
		if float(bot.money) < float(estimate["material_cost"]) * material_budget_share:
			continue
		var score: float = _job_score(bot, job, estimate)
		if score > best_score:
			best_score = score
			best_job = job
			best_index = i
			best_estimate = estimate
	if best_job == null:
		return
	var taken: Job = JobBoard.remove_job_by_index(best_index)
	if taken == null:
		return
	bot.project = BotProject.new(taken)
	bot.estimated_profit = int(best_estimate["margin"])
	bot.state = Bot.State.WORKING
	Signals.journal_log("День %d · %s взял заказ: %s (бюджет %s руб., приб. ~%s руб.)" % [
		int(GameManager.day), bot.name, taken.get_building_display_name(),
		_format_num(taken.budget), _format_num(bot.estimated_profit),
	])


## Скор заказа для бота по стратегии.
func _job_score(bot: Bot, job: Job, estimate: Dictionary) -> float:
	var budget: float = float(job.budget)
	var margin_ratio: float = float(estimate["margin"]) / budget if budget > 0 else 0.0
	var speed_score: float = clampf(1.0 - float(estimate["man_hours"]) / 400.0, 0.0, 1.0)
	var budget_ratio: float = clampf(budget / 2_500_000.0, 0.0, 1.0)
	var s: int = int(bot.strategy)
	var profit_w: float = float((BOT_BALANCE["profit_w"] as Array)[s])
	var speed_w: float = float((BOT_BALANCE["speed_w"] as Array)[s])
	var budget_w: float = float((BOT_BALANCE["budget_w"] as Array)[s])
	return profit_w * margin_ratio + speed_w * speed_score + budget_w * budget_ratio


## Приблизительная себестоимость и маржа заказа по текущим ценам рынка.
func _estimate(job: Job) -> Dictionary:
	var stages: Array = Database.get_building_stages(job.building_type)
	var material_cost: int = 0
	var man_hours: float = 0.0
	for stage in stages:
		for material_id in stage.get("materials", {}):
			material_cost += int(stage["materials"][material_id]) * Market.get_price(material_id)
		man_hours += float(stage.get("man_hours", 0.0))
	var labor_cost: int = int(man_hours * float(BOT_BALANCE.get("est_wage_per_man_hour", 150)))
	var margin: int = job.budget - material_cost - labor_cost
	return {"material_cost": material_cost, "labor_cost": labor_cost, "man_hours": man_hours, "margin": margin}


## Списывает ежедневный платёж по кредиту и закрывает его, когда погашен.
func _pay_loan(bot: Bot) -> void:
	if not bot.has_loan():
		return
	var pay: int = mini(int(bot.loan["daily"]), int(bot.loan["remaining"]))
	pay = mini(pay, bot.money)
	if pay > 0:
		bot.money -= pay
	bot.loan["remaining"] = int(bot.loan["remaining"]) - pay
	if int(bot.loan["remaining"]) <= 0:
		var total: int = int(bot.loan["total"])
		bot.loan = {}
		Signals.journal_log("День %d · %s погасил кредит: %s руб." % [
			int(GameManager.day), bot.name, _format_num(total),
		])


## Берёт кредит, если проект застрял из-за нехватки денег на текущие нужды.
func _take_loan_if_stuck(bot: Bot) -> void:
	if bot.has_loan():
		return
	if not bot.has_missing_materials():
		return
	var hours: int = int(BOT_BALANCE.get("wage_work_hours_per_day", 8))
	var daily_needs: int = bot.get_crew_hourly_rate() * hours + int(BOT_BALANCE.get("rental_cost_per_day", 5_000))
	if bot.money >= daily_needs:
		return
	var amount: int = 500000
	bot.loan = BankManager.compute_loan(amount)
	bot.money += amount
	Signals.journal_log("День %d · %s взял кредит: +%s руб. под %.0f%% (%s руб. к возврату)." % [
		int(GameManager.day), bot.name, _format_num(amount),
		float(bot.loan["rate"]) * 100.0, _format_num(int(bot.loan["total"])),
	])


## Нанимает рабочих из общего пула HR до max_crew, пока позволяет бюджет на зарплату.
func _hire_workers(bot: Bot) -> void:
	var max_crew: int = int(BOT_BALANCE.get("max_crew", 3))
	var hours: int = int(BOT_BALANCE.get("wage_work_hours_per_day", 8))
	while bot.crew.size() < max_crew:
		var next_wage: int = (bot.get_crew_hourly_rate() + _expected_wage(bot)) * hours
		if bot.money < next_wage:
			break
		var worker: Worker = _pop_worker_for_strategy(bot)
		if worker == null:
			break
		bot.add_worker(worker)
		# Найм рабочим идёт в журнал только через итоги заказа (держать лог чистым).


## Ожидаемая ставка нового рабочего под стратегию бота.
func _expected_wage(bot: Bot) -> int:
	match int(bot.strategy):
		Bot.Strategy.CONSERVATIVE:
			return 1000
		Bot.Strategy.AGGRESSIVE:
			return 1700
	return 1300


## Берёт из пула рабочего под стратегию (предпочтение), иначе любого.
func _pop_worker_for_strategy(bot: Bot) -> Worker:
	var pref: Callable = Callable()
	match int(bot.strategy):
		Bot.Strategy.CONSERVATIVE:
			pref = func(w: Worker) -> bool: return w.type == Worker.WorkerType.HANDYMAN
		Bot.Strategy.AGGRESSIVE:
			pref = func(w: Worker) -> bool: return w.type != Worker.WorkerType.HANDYMAN
	var worker: Worker = HR.pop_available_worker(pref)
	if worker == null:
		# Предпочитаемый тип недоступен — берём любого, чтобы не голодать.
		worker = HR.pop_available_worker()
	return worker


## Закупает недостающие материалы для текущего и следующего этапов.
func _stock_materials(bot: Bot) -> void:
	var hours: int = int(BOT_BALANCE.get("wage_work_hours_per_day", 8))
	var wage: int = bot.get_crew_hourly_rate() * hours
	# Не тратим деньги, нужные на оплату сегодняшнего труда и аренды.
	var spendable: int = bot.money - wage - int(BOT_BALANCE.get("rental_cost_per_day", 5_000))
	if spendable <= 0:
		return
	var stages_to_stock: Array[int] = [bot.project.current_stage_index]
	if bot.project.has_stage_materials(bot.project.current_stage_index):
		var next: int = bot.project.current_stage_index + 1
		if next < bot.project.stages.size():
			stages_to_stock.append(next)
	for stage_index in stages_to_stock:
		var missing: Dictionary = bot.project.get_missing_materials_for_stage(stage_index)
		var blocked: bool = stage_index == bot.project.current_stage_index and not bot.has_no_crew()
		for material_id in missing:
			if spendable <= 0:
				return
			var price: int = Market.get_price(material_id)
			var available: int = Market.get_stock(material_id)
			if price <= 0 or available <= 0:
				continue
			var avg: float = Market.get_price_history_average(material_id)
			var ratio: float = float(price) / avg if avg > 0 else 1.0
			if ratio > float(BOT_BALANCE.get("buy_ratio_max", 1.10)):
				if not blocked or ratio > float(BOT_BALANCE.get("emergency_premium_ratio", 1.25)):
					continue
			var max_qty: int = missing[material_id]
			var by_money: int = spendable / price
			var by_market: int = available
			var qty: int = mini(mini(max_qty, by_money), by_market)
			if qty <= 0:
				continue
			# Боимся переплатить сильно при некритичном товаре.
			if ratio > float(BOT_BALANCE.get("buy_ratio_good", 0.95)) and not blocked:
				qty = mini(qty, maxi(1, int(float(max_qty) * 0.5)))
			var cost: int = Market.ai_buy(material_id, qty)
			if cost <= 0:
				continue
			bot.money -= cost
			spendable -= cost
			bot.project.add_materials_to_stage(stage_index, material_id, qty, cost)
		if spendable <= 0:
			return


## Один строительный день: прогресс + оплата труда и аренды из бюджета.
func _build_day(bot: Bot) -> void:
	var hours: int = int(BOT_BALANCE.get("wage_work_hours_per_day", 8))
	var rental: int = int(BOT_BALANCE.get("rental_cost_per_day", 5_000))
	var daily_wage: int = bot.get_crew_hourly_rate() * hours
	# Сбрасываем излишек дорогих рабочих, пока не будет хватать денег на день.
	while bot.money < daily_wage + rental and not bot.has_no_crew():
		_shed_most_expensive(bot)
		daily_wage = bot.get_crew_hourly_rate() * hours
	if bot.has_no_crew():
		return
	if not bot.project.has_stage_materials(bot.project.current_stage_index):
		return
	var man_hours_done: float = bot.get_crew_efficiency() * float(hours)
	bot.project.advance(man_hours_done)
	bot.money -= daily_wage
	bot.project.wages_paid += daily_wage
	bot.money -= rental
	bot.project.rental_paid += rental


## Возвращает в пул самого дорогого рабочего бригады.
func _shed_most_expensive(bot: Bot) -> void:
	var worst: Worker = null
	var worst_rate: int = -1
	for worker in bot.crew:
		if worker.rate_per_hour > worst_rate:
			worst_rate = worker.rate_per_hour
			worst = worker
	if worst == null:
		return
	bot.crew.erase(worst)
	HR.return_worker(worst)


## Сдача заказа: вознаграждение, прибыль, штраф за просрочку, возврат рабочих, пауза.
func _deliver(bot: Bot) -> void:
	var net: int = bot.get_live_profit()
	var budget: int = bot.project.job.budget
	var job_name: String = bot.project.job.get_building_display_name()
	var payment: int = budget
	var penalty: int = 0
	var late: bool = GameManager.day > bot.project.job.deadline_day
	if late:
		penalty = maxi(0, int(float(net) * ConstructionManager.LATE_PENALTY_PERCENT))
		payment = maxi(0, budget - penalty)
		net = maxi(0, net - penalty)
	bot.money += payment
	bot.total_profit += net
	bot.jobs_done += 1
	bot.release_crew()
	bot.project = null
	bot.cooldown_days = randi_range(int(BOT_BALANCE.get("cooldown_min", 2)), int(BOT_BALANCE.get("cooldown_max", 4)))
	bot.state = Bot.State.COOLDOWN
	var suffix: String = " (приб. %s руб., капитал %s руб.)" % [_format_num(net), _format_num(bot.money)]
	if late and penalty > 0:
		var full: String = "День %d · %s сдал заказ: %s с просрочкой | штраф %s руб. | приб. %s руб., капитал %s руб." % [
			int(GameManager.day), bot.name, job_name,
			_format_num(penalty), _format_num(net), _format_num(bot.money),
		]
		Signals.journal_log(full)
	elif late:
		var overdue: String = "День %d · %s сдал заказ: %s с просрочкой | штраф 0 руб. | приб. %s руб., капитал %s руб." % [
			int(GameManager.day), bot.name, job_name,
			_format_num(net), _format_num(bot.money),
		]
		Signals.journal_log(overdue)
	else:
		Signals.journal_log("День %d · %s сдал заказ: %s%s" % [int(GameManager.day), bot.name, job_name, suffix])


## Форматирует число с разделителями тысяч для строк журнала.
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
