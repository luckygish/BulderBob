# Формулы и механики игры «Булдер»

Справочник всех расчётных формул и правил работы механик. Каждый блок: формальное
описание, обозначения, численные константы и источник в коде. Оформлено по мотивам
`README.md` — все числа выверены по исходникам.

Список источников:
`autoload/game_manager.gd`, `autoload/market.gd`, `autoload/job_board.gd`,
`autoload/hr.gd`, `autoload/equipment_manager.gd`, `autoload/construction_manager.gd`,
`autoload/ai_competitor.gd`, `data/project.gd`, `data/bot_project.gd`, `data/worker.gd`,
`data/worker_skills.gd`, `data/equipment.gd`, `data/provision.gd`, `data/job.gd`, `data/bot.gd`.

---

## 1. Время и экономика

### 1.1 Тик времени
- Игровая единица времени — **час**. Один тик = 1 игровой час.
- **Рабочий день**: `08:00 ≤ hour < 18:00` (`game_manager.gd`, `is_work_hours()`).
- Смена суток: при `hour ≥ 24` → `hour := 0`, `day := day + 1` (`_on_hour_tick()`).

### 1.2 Скорость времени
Интервал реального таймера на 1 игровой час (`_update_timer()`):

| Скорость | wait (секунд на игровой час) |
| --- | --- |
| ×1 | **40** |
| ×2 | **10** |
| ×4 | **2** |

### 1.3 Деньги
- Потратить: `spend(amount) = (amount ≥ 0) И (money ≥ amount)` → `money -= amount`, иначе false.
- Получить: `earn(amount)` при `amount > 0` → `money += amount`.
- Стартовый капитал: **2 000 000 руб**.
- Обе операции эмитят сигнал `money_changed`.

---

## 2. Рынок материалов

Источник: `autoload/market.gd`. Модель — **лотовые FIFO-очереди**: у каждого лота своя
цена и объём; покупка списывает единицы со старейших лотов.

Константы `BALANCE`:
`sensitivity=0.6`, `lot_size_mult=1.0`, `price_floor=0.5`, `price_cap=1.8`,
`qty_floor_mult=0.25`, `qty_cap_mult=4.0`, `aging_age=9`, `aging_threshold=0.6`,
`aging_discount=0.15`. Плюс `RESTOCK_INTERVAL_DAYS=3` (поставки и перерасчёт цен
происходят **раз в 3 дня**, по дням, кратным 3), `PRICE_HISTORY_WINDOW=30`.

### 2.1 Цена новой поставки (перерасчёт раз в `RESTOCK_INTERVAL_DAYS` дней)
```
ratio      = demand_window / (RESTOCK_INTERVAL_DAYS · base_daily_demand)
price_mult = clamp(1 + sensitivity · (ratio − 1), price_floor, price_cap)
price      = max(1, round(base_price · price_mult))
```
- `demand_window` — сколько единиц материала куплено всеми участниками (игроком и ботами)
  со сбросом за прошедший период.
- `base_daily_demand` — справочная норма спроса материала (`database.gd`).

### 2.2 Объём нового лота
```
qty_mult = clamp(ratio, qty_floor_mult, qty_cap_mult)
qty      = max(1, round(base_daily_demand · RESTOCK_INTERVAL_DAYS · lot_size_mult · qty_mult))
qty      = max(qty, stock_min)
```
- `stock_min` — минимальный остаток склада материала (`database.gd`).

### 2.3 Стоимость покупки (FIFO)
Для `need` единиц берём по каскаду со **старейших** лотов:
```
total = Σᵢ min(осталось_need, qtyᵢ) · priceᵢ
```
Списываем со старейших лотов; лот удаляется при `qty ≤ 0`.

### 2.4 Уценка невостребованных лотов (каждый день)
Для каждого лота, если одновременно выполняются:
```
current_day − arrived_day > aging_age            (9 дней)
remaining_ratio = lot.qty / lot.initial_qty ≥ aging_threshold   (0.6)
```
цeна снижается:
```
floor_price = max(1, round(base_price · price_floor))
lot.price   = max(floor_price, round(lot.price · (1 − aging_discount)))
```
Итого максимальная глубина уценки — до `price_floor` (!) от базовой цены.

### 2.5 Склад игрока
- Покупка: `player_inventory[id] += qty`; одновременно растёт `demand_window[id]`.
- `allocate_stage_from_inventory(project, stage)`: со склада на этап переносится
  `take = min(нужно_ещё, на_складе)` по каждому требуемому материалу;
  при этом `actual_material_cost += take · текущая_цена`.

---

## 3. Заказы

Источник: `autoload/job_board.gd`.

### 3.1 Срок сдачи
```
deadline_day = текущий_день + randi_range(14, 30)
```
Фиксируется при генерации заказа на доске (не при взятии). Типы зданий:
Каркасный дом, Кирпичный дом, Реконструкция, Дом из газоблоков; бюджеты генерируются
в диапазоне, заданном для типа (`database.gd`, `generate_budget()`).

### 3.2 Истечение заказа
Заказ убирается с доски, если:
```
deadline_day − current_day < 3   (EXPIRE_THRESHOLD_DAYS)
```
Пополнение: каждый день на доску добавляется `randi_range(1,2)` заказа, всего на доске
одновременно **3–5** (`MIN_JOBS=3`, `MAX_JOBS=5`).

### 3.3 Взятие заказа
Активный проект у игрока — **один** одновременно. При взятии из заказа создаётся
`Project`, назначается бригада, проверяется готовность этапов.

---

## 4. Строительство (игрок)

Источник: `data/project.gd`, `data/worker.gd`, `data/worker_skills.gd`, `autoload/hr.gd`,
`autoload/construction_manager.gd`.

### 4.1 Прирост прогресса за рабочий час
На каждый игровой час рабочего дня (или ночью при навыке «Сова» или «Автоматизации»)
прогресс идёт **только по объектам, на которые назначена бригада** (`project.has_crew()`);
объекты без бригады подготавливаются, но не строятся. Одна бригада = один объект:
```
Δstage_progress = crew_efficiency / man_hours_этапа
```
- `man_hours_этапа` — нормативная трудоёмкость этапа (например, фундамент 30).
- Этап завершается при `stage_progress ≥ 1.0` → `_complete_stage()`.
- При сдаче объекта бригада освобождается и автоназначается на первый свободный объект.

### 4.2 Эффективность бригады (`hr.gd → calculate_team_efficiency`)
```
eff = Σᵢ ( worker.efficiencyᵢ + worker_bonus ) · speed_multiplierᵢ
     + ( если есть ≥1 прораб и есть «остальные» ) Σ_прораб team_bonus · кол_во_остальных
```
где:
```
speed_multiplier(w) = 1 + Σ (speed_свойств_навыков)
team_bonus прораба   = 0.2
worker_bonus         = 0.0            # до/без технологий
                    = 0.2            # «Обучение рабочих»
                    = 0.4            # «Профстандарты»
```
- `worker_bonus` для бригады игрока применяется только при `apply_bonus = true`.

### 4.3 Рабочие и навыки (`data/worker.gd`, `data/worker_skills.gd`)

| Тип | efficiency | team_bonus | Ставка (руб/ч, равномерно) |
| --- | --- | --- | --- |
| Разнорабочий | 0.8 | 0 | 800 – 1 200 |
| Специалист | 1.0 | 0 | 1 200 – 1 600 |
| Прораб | 1.1 | 0.2 | 1 800 – 2 300 |

| Навык | Эффект |
| --- | --- |
| Алкоголизм | `speed: −0.15` |
| Трудяга | `speed: +0.20` |
| Сова | стройка ночью не останавливается |
| Вор | `material_mul: 1.05` (см. 4.6) |

На каждом рабочем 1–3 случайных уникальных навыка; **прораб не получает негативных**
(Алкоголизм, Вор).

### 4.4 Человеко-часы и зарплата
- За каждый рабочий час: `labor_cost += сумма_ставок_бригады`; `total_work_hours += 1`.
- **Плановая** зарплата до старта стройки (если `labor_cost == 0`):
  ```
  плановая_зарплата = ставка_часа · Σ man_hours / eff
  ```
- Список зарплат в конце дня:
  ```
  to_pay = labor_cost − deducted_wages
  если to_pay > 0 и хватает денег: deducted_wages := labor_cost
  ```

### 4.5 Прогресс всего проекта
```
get_total_progress = ( Σ man_hours_завершённых + man_hours_текущего_этапа · stage_progress )
                     / Σ man_hours_всех_этапов
```

### 4.6 Смета и прибыль
```
material_cost = actual_material_cost · (1.05, если в бригаде есть «Вор», иначе 1.0)
labor_cost    = фактическое накопление (см. 4.4)
profit        = budget − material_cost − labor_cost
```

### 4.7 Штраф за просрочку
```
если current_day > deadline_day:
    penalty = round(profit · LATE_PENALTY_PERCENT)      # 0.05
    profit  = max(0, profit − penalty)
payment = max(0, budget − penalty)
```

### 4.8 Условия старта этапа
Одна из групп техники этапа (для «Фундамента»: `[mixer]` ИЛИ `[tractor]`), обязательное
обеспечение (для этапа 1), материалы доступны, бригада не пуста. При самостройке
(`auto_advance`) следующие готовые этапы стартуют автоматически.

---

## 5. Техника и обеспечение

Источник: `autoload/equipment_manager.gd`, `data/equipment.gd`, `data/provision.gd`.

### 5.1 Покупка
`buy_equipment(id)`: требуется свободный слот-та (нельзя купить второй раз), списать полную `base_price`.

### 5.2 Лизинг (рассрочка)
```
interest   = 0.25
lease_total      = round(base_price · (1 + interest) · (1 − leasing_discount))
lease_daily      = ceil(lease_total / lease_days)        # lease_days = 7
lease_remaining  = (expires_day − last_paid_day) · lease_daily
```
- `leasing_discount` = 0 при без технологий; = 0.05 после «Выгодного лизинга» (`bank_manager.gd`).
- Ежедневно (при `last_paid_day < day`): списать `lease_daily`; если денег нет — техника
  пропадает. При `day ≥ expires_day` → статус «своя».
- Досрочное погашение: заплатить `lease_remaining` → статус «своя».

### 5.3 Аренда (почасовая)
```
cost = hours · rent_per_hour        # hours ≥ rent_min_hours (минимум 8)
```
Каждый игровой час: `remaining_hours −= 1`; при `≤ 0` аренда заканчивается (техника исчезает).

### 5.4 Обеспечение и требования
- Обязательное обеспечение для старта стройки (этап 1): все из
  **Бытовка, Биотуалет, Канистра воды, Генератор, Ручной инструмент**.
- Требование «Фундамента» по технике: достаточно **одной** единицы из группы
  `[Бетономешалка]` или `[Трактор]` (структура «группы альтернатив»).

### 5.5 Кредиты (`autoload/bank_manager.gd`, игрок и боты)

Схема: фиксированная равная ежедневная доля за **10 дней**; ставка — итоговая за срок.
```
total     = round(amount · (1 + rate))
daily     = round(total / 10)
платёж_дн = min(daily, remaining)
остаток  -= платёж_дн;  обнуление, когда остаток ≤ 0
```
- Кредиты: **500 000** под **15%** → `total = 575 000`, `daily = 57 500`;
  **800 000** под **17%** → `total = 936 000`, `daily = 93 600`.
- Игрок: один активный кредит, доступ после технологии «Банковский счет».
- Боты: берут автоматически при нехватке денег, не зависят от технологии игрока.
- При нехватке средств платёж ограничен балансом, остаток переносится на следующие дни.

---

## 6. Конкуренты-боты

Источник: `autoload/ai_competitor.gd`, `data/bot.gd`, `data/bot_project.gd`.

Три бота: СтройГрад (агрессивный), ДомМастер (умеренный), АтлантСтрой (консервативный).
Стартовый бюджет каждого — **1 200 000 руб**.

### 6.1 Оценка заказа (`_estimate`)
```
material_cost = Σ по этапам Σ по материалам ( qty · текущая_цена_рынка )
labor_cost    = Σ man_hours · est_wage            # est_wage = 150 руб/чел-час
margin        = budget − material_cost − labor_cost
```
Заказ берётся, если `margin > 0` и `money ≥ material_cost · 0.85`.

### 6.2 Скор выбора заказа (стратегии)
```
margin_ratio = margin / budget
speed_score  = clamp(1 − man_hours / 400, 0, 1)
budget_ratio = clamp(budget / 2_500_000, 0, 1)
score        = profit_w · margin_ratio + speed_w · speed_score + budget_w · budget_ratio
```
Веса по стратегии (`BOT_BALANCE`):

| Стратегия | profit_w | speed_w | budget_w |
| --- | --- | --- | --- |
| Агрессивный | 1.0 | 0.3 | 0.25 |
| Умеренный | 1.0 | 0.6 | 0.05 |
| Консервативный | 1.0 | 1.0 | 0.0 |

Берётся заказ с максимальным `score`.

### 6.3 Закупки материала
```
spendable = money − (ставка_бригады · 8) − rental_per_day      # rental_per_day = 5 000
qty       = min( min(missing, spendable / price), рыночный_остаток )
```
Фильтр цены: `ratio_price = price / avg_price_history`. Покупаем, если не переплачиваем:
`ratio_price > 1.10` → пропуск, кроме критического случая `ratio_price > 1.25` для блокирующего этапа;
при `ratio_price > 0.95` и не критично → не более 50% недостатка.

### 6.4 Стройка за день
```
man_hours_done = bot_crew_eff · 8     # рабочие часы бота в день
списать: wages  = ставка_бригады · 8
         rental = 5 000
```
Если денег не хватает на `daily_wage + rental` — уволить самого дорогого рабочего (`_shed_most_expensive`).

### 6.5 Прогресс бота (`bot_project.gd → advance`)
Дневной запас `man_hours_done` переносится по текущему и последующим этапам:
- пока `man_hours_done > 0` и проект не завершён:
  - если не хватает на этап — `stage_progress = накопленное_на_этап / man_hours_этапа`,
    засчитать оставшиеся часы и выйти;
  - иначе этап завершается (засчитывая полные `man_hours`), переход к следующему.
```
total_progress = total_man_hours_done / Σ man_hours
remaining       = max(0, Σ man_hours − total_man_hours_done)
```

### 6.6 Сдача заказа
```
net    = budget − material_spent − wages_paid − rental_paid
если current_day > deadline_day:
    penalty = max(0, net · 0.05)
    net     = max(0, net − penalty)
payment = max(0, budget − penalty)
money  += payment ; total_profit += net ; jobs_done += 1
```
Бот возвращает рабочих в общий пул и уходит на паузу **2–3 дня** (`cooldown_min..max`).

### 6.7 Уровень бота (`bot.gd → get_level_label`)
```
Новичок : total_profit < 1_000_000
Опытный : 1_000_000 ≤ total_profit < 3_000_000
Профи   : total_profit ≥ 3_000_000
```

---

## 7. Проверочные примеры (для сверки формул)

### Прогресс фундамента (игрок)
Фундамент: `man_hours = 30`.

- Бригада: 2 специалиста (eff 1.0, без навыков):
  ```
  eff = 2.0
  прогресс_за_час = 2.0 / 30 ≈ 0.0667
  время = 30 / 2.0 = 15 рабочих часов
  ```
- Бригада: 2 специалиста + прораб:
  ```
  eff = (1.0·1 + 1.0·1 + 1.1) + (0.2 · 2) = 3.5
  время = 30 / 3.5 ≈ 8.6 рабочих часа
  ```
- С навыком «Алкоголизм» у одного специалиста скорость ×0.85:
  ```
  eff = 1.0·0.85 + 1.0 = 1.85 → время = 30 / 1.85 ≈ 16.2 ч
  ```

### Цена лота (индексный пример)
Допустим `base_daily_demand = 150`, `demand_window = 450` (накоплено за 3 дня),
`RESTOCK_INTERVAL_DAYS = 3`, `ratio = 450 / (3·150) = 1.0`:
```
price_mult = clamp(1 + 0.6·(1.0 − 1), 0.5, 1.8) = 1.0
price      = round(base · 1.0)
qty_mult   = clamp(1.0, 0.25, 4.0) = 1.0
qty        = round(150 · 3 · 1.0) = 450
```

### Скор бота (иллюстрация)
`man_hours = 176`, `budget = 2 500 000`, margin = 30% бюджета, стратегия «Умеренный»:
```
margin_ratio = 0.30
speed_score  = clamp(1 − 176/400, 0, 1)   = 0.56
budget_ratio = clamp(2.5М / 2.5М, 0, 1)   = 1.0
score        = 1.0·0.30 + 0.6·0.56 + 0.05·1.0 = 0.686
```