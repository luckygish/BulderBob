# Формулы и механики браузерной версии «Булдер»

Актуальный код находится в `web/src/game/`. Формат сохранения — **версия 4**;
миграция выполняется последовательно v1 → v2 → v3 → v4 в `persistence.ts`.

---

## 1. Время

- Тик — 1 игровой час.
- Обычный рабочий день: `8 ≤ hour < 18`.
- Летние сезоны добавляют 1 час: `workDayEnd = 18 + extraWorkHour`.
- Интервал тика: ×1 — 2000 мс, ×2 — 1000 мс, ×4 — 250 мс.

Ночной тариф:

```
nightMultiplier = 1.5
  · (1 + seasonNightWageRate)
  · (night_coordinator ? 0.9 : 1)
```

С «Ночным координатором» базовый тариф становится 1,35.

---

## 2. Сезоны

Десять сезонов по 90 дней описаны в `seasons.ts`.

### Цель сезона

```
успех = netWorth ≥ goal.capital
      AND reputation ≥ goal.reputation
      AND seasonCompleted ≥ goal.completed
```

### Эффекты сезонов

Каждая отрицательная сезонная ставка применяется так:

```
effectiveRate = seasonRate · (seasonal_planning ? 0.9 : 1)
```

Затем:

```
materialCost  = rawCost · (1 + materialPriceRate)
foundationHours = manHours · (1 + foundationHoursRate)
maintenanceRate = 0.001 · (1 + seasonalMaintenanceRate)
```

Летний дополнительный рабочий час не уменьшается технологией.

### Переход сезона

```
reputation += success ? +5 : −15
seasonIndex = min(seasonIndex + 1, 9)
day = 1
hour = 8
seasonCompleted = 0
seasonRevenue = 0
paused = true
```

Активные проекты сохраняются. Следующие даты сдвигаются на −90 дней: сроки проектов,
поставок, заказов на доске и проектов ботов.

---

## 3. Технологии

| ID | Ветка | Цена | Дней | Требование | Эффект |
| --- | --- | ---: | ---: | --- | --- |
| `planning_1` | Управление | 300 000 | 2 | — | 2 объекта |
| `seasonal_planning` | Управление | 450 000 | 3 | `planning_1` | Дебаффы сезона ×0,9 |
| `planning_2` | Управление | 1 500 000 | 4 | `planning_1` | 3 объекта |
| `planning_3` | Управление | 2 500 000 | 7 | `planning_2` | 4 объекта |
| `worker_training` | Персонал | 200 000 | 2 | — | +0,2 эффективности |
| `night_coordinator` | Персонал | 400 000 | 3 | `worker_training` | Ночной тариф ×0,9 |
| `prof_standards` | Персонал | 800 000 | 4 | `worker_training` | +0,4 и вторая бригада |
| `automation` | Персонал | 1 200 000 | 5 | `prof_standards` | Ночные смены |
| `bank_account` | Финансы | 150 000 | 1 | — | Банк и отчётность |
| `overdraft` | Финансы | 350 000 | 2 | `bank_account` | Лимит долга 300 000 ₽ |
| `good_leasing` | Финансы | 500 000 | 3 | `bank_account` | Лизинг −5% |
| `dealer_network` | Финансы | 500 000 | 3 | `good_leasing` | Продажа техники 80% |
| `factoring` | Финансы | 400 000 | 4 | `good_leasing` | Аванс 30%, комиссия 2% |

---

## 4. Рабочие

### Эффективность

```
speed(w) = max(0.1, 1 + Σ speed_навыков)
base(w) = typeEfficiency + workerBonus

eff = Σ base(w) · speed(w)
    + Σ [typeTeamBonus(w) + Σ teamBonus_навыков(w)] · (crewSize − 1)
```

Типы: разнорабочий 0.8, специалист 1.0, прораб 1.1. Командный бонус прораба +0.2.

### Зарплата

```
hourly = Σ round(rate(w) · (1 + Σ wageRate_навыков))
actualHourly = hourly · (1 + seasonWageRate)
nightWages = actualHourly · nightMultiplier
```

---

## 5. Рынок и резервы

FIFO-закупка:

```
rawCost = Σ взято_из_лота · price
cost = round(rawCost · (1 + materialPriceRate))
fee = round(cost · feeRate)
```

Север: 2%, сегодня. Юг: 3,5%, завтра, стартовая цена −5% от базы.

Масштабная закупка (≥25% остатка базы за одну покупку) мгновенно поднимает цену
оставшихся лотов:

```
bump = share − 0.25            // доля остатка, купленная разом
lot.price = min(cap, lot.price · (1 + 0.5 · bump))
cap = round(basePrice · 1.35)  // 1.35 — priceCap
```

Пересчёт поставок каждые 3 дня:

```
expected = dailyDemand · 3
ratio = спрос_за_3_дня / expected
priceMultiplier = clamp(0.8, 1 + 0.5 · (ratio − 1), 1.35)
price = round(basePrice · priceMultiplier)
quantity = clamp(0.25, ratio, 4) · expected, ограничено stockMax
```

Недостающее для проекта:

```
need = required − allocated − projectReserved − commonInventory
```

Быстрая закупка сразу пополняет резерв проекта. При обеспечении этапа сначала расходуется
резерв, затем общий склад. Себестоимость:

```
materialCost += takenCost · max(0.85, 1 + Σ materialRate_навыков)
```

Остаток резерва возвращается после сдачи.

---

## 6. Техника и обслуживание

Бонус этапа:

```
equipmentBonus = stageBonus · (1 + Σ equipmentBonusRate_навыков)
progress += crewEfficiency · (1 + equipmentBonus) / stageManHours
```

Бонусы: трактор +30% фундамента, экскаватор +45%, манипулятор +15% стен/+10% отделки,
кран +10% монтажа/+20% кровли. Бетономешалка даёт допуск без бонуса.

Продажа:

```
saleRate = dealer_network ? 0.8 : 0.7
sellPrice = round(basePrice · saleRate)
```

Обслуживание:

```
maintenance = round(price · 0.001
  · (1 + seasonMaintenanceRate))
```

Аренда: `hours · rentPerHour`, минимум 8 часов; часы расходуются на объекте.
Лизинг: взнос 20%, сумма `price · 1.12`, выплаты 30 дней.

---

## 7. Обеспечение

```
ownedProvision ≥ activeProjects
price = round(basePrice · (1 + provisionRate))
```

---

## 8. Строительство и сдача

Трудоёмкость всех этапов составляет 115% от базовой (база указана в каталоге);
требования к материалам при этом не изменяются. Срок заказа рассчитывается от
трудоёмкости (`4 + ceil(Σ manHours / 35) + рандом`), поэтому он растёт вместе с ней.

### Прогресс

```
stageManHours = manHours · (1 + foundationHoursRate)
progress += crewEfficiency · (1 + equipmentBonus) / stageManHours
```

### Деньги при сдаче

```
penalty = round(budget · min(0.15, lateDays · 0.03))
finalPayment = max(0, budget − penalty − advance)
money += finalPayment
```

При факторинге 30% бюджета уже получено при взятии заказа за вычетом комиссии 2%.

### Прибыль и репутация

```
profit = budget − materialCost − laborCost − logisticsCost
       − equipmentCost − factoringFee − penalty

reputation += lateDays > 0 ? −2 · lateDays : building.reputationReward
```

Обычное здание даёт +2 репутации; особые — от +7 до +10.

При сдаче:

```
seasonCompleted += 1
seasonRevenue += budget − penalty
totalRevenue += budget − penalty
```

---

## 9. Особые заказы

```
P(особый заказ каждые 3 дня) = 0.20
```

Особый заказ живёт 2–5 дней. Боты его игнорируют.

---

## 10. Финансы и овердрафт

### Обычный долг

- Без овердрафта любой долг блокирует новые расходы и стройку.
- После овердрафта блокировка начинается при `debt > 300 000 ₽`.
- Каждый день до автопогашения:

```
debt = ceil(debt · 1.01)
payment = min(max(0, money), debt)
money -= payment
debt -= payment
```

### Кредиты

```
total = amount · (1 + rate)
daily = round(total / 30)
```

500 000 ₽ под 6% или 800 000 ₽ под 8%.

### Капитал

```
capital = money + ownedEquipmentPrice − debt − loanRemaining
```

---

## 11. Финансовый отчёт

После `bank_account` игра записывает ежедневный срез:

```ts
{
  day,
  capital: netWorth(state),
  cash: money,
  reputation,
  seasonCompleted
}
```

Хранится последние 120 записей. На странице отчёта они преобразуются в SVG-графики
капитала, денег, репутации, выручки, прибыли и структуры затрат.

---

## 12. Компания

Название допускается от 2 до 30 символов. Аватар — число 0–4, выводится как один из
пяти встроенных SVG.

Статус определяется только текущим капиталом:

```text
< 2 500 000       — ИЖС · Частный подряд
2 500 000–5 млн   — Местный застройщик
5–10 млн          — Региональный подрядчик
10–18 млн         — Городской девелопер
18–30 млн         — Федеральный застройщик
≥ 30 млн          — Корпорация недвижимости
```

Прогресс до следующего статуса:

```
progress = (capital − currentThreshold) / (nextThreshold − currentThreshold)
```

---

## 13. Конкуренты

Боты используют общие заказы, кандидатов и рынок, но не берут особые проекты.

```
materials = Σ frontPrice · qty
labor = manHours · 1400
margin = budget − materials − labor
```

Ежедневные расходы:

```
wages = crewHourly · 10
rental = 35 000
```

После сдачи бот возвращает рабочих в общий пул и находится в паузе 2–4 дня.
