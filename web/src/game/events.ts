import type { EventDef } from './types'

export const EVENTS: EventDef[] = [
  {
    id: 'mortgage', season: 0, day: 11,
    eyebrow: 'Your wife calls', title: 'Mortgage payment',
    text: 'Your wife calls to remind you: the mortgage payment is overdue. The bank demands the debt be settled by the end of the week, or there will be penalties.',
    options: [
      {
        label: 'Pay $50,000', hint: '−$50,000',
        effect: { cash: -50_000 },
        outcome: 'The mortgage is paid, the family is at ease.',
      },
    ],
  },
  {
    id: 'migration', season: 1, day: 13,
    eyebrow: 'Call from the site', title: 'Migration service',
    text: 'A worker calls from the project: the migration service wants to take the crew — paperwork is not in order. You need to decide by evening.',
    options: [
      {
        label: 'Pay them off — $100,000', hint: '−$100,000',
        effect: { cash: -100_000 },
        outcome: 'The inspector is satisfied, the crew stays on site.',
      },
      {
        label: 'Process the documents', hint: '+3 days to all deadlines',
        effect: { delayDays: 3 },
        outcome: 'The paperwork takes three days — construction stands still.',
      },
    ],
  },
  {
    id: 'theft', season: 1, day: 27,
    eyebrow: 'Talk with the storekeeper', title: 'Warehouse theft',
    text: 'The storekeeper noticed: part of the cable and fasteners was hauled out of the warehouse at night. The damage is about forty thousand.',
    options: [
      {
        label: 'Call the police', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'The police took statements — the crew spent two days answering questions.',
      },
      {
        label: 'Write it off as losses', hint: '−$40,000',
        effect: { cash: -40_000 },
        outcome: 'The theft was written off and construction stays on schedule.',
      },
    ],
  },
  {
    id: 'wet_lumber', season: 2, day: 5,
    eyebrow: 'Morning walk through the yard', title: 'Soaked lumber',
    text: 'The workers did not cover the lumber from the rain — the material is covered in mold. Buy antiseptic or accept the losses at the warehouse.',
    options: [
      {
        label: 'Buy antiseptic — $10,000', hint: '−$10,000',
        effect: { cash: -10_000 },
        outcome: 'The lumber is treated and the material is saved.',
      },
    ],
  },
  {
    id: 'broken_window', season: 2, day: 24,
    eyebrow: 'Neighbors of the site next door', title: 'Broken window',
    text: 'The crane boom hit the window of a neighboring house. The owner demands an immediate fix, or they will complain to the administration.',
    options: [
      {
        label: 'Pay for the repair — $25,000', hint: '−$25,000',
        effect: { cash: -25_000 },
        outcome: 'The window is installed, the conflict is settled.',
      },
      {
        label: 'Ignore it', hint: '−8 reputation',
        effect: { reputation: -8 },
        outcome: 'The complaint reached the administration — reputation suffered.',
      },
    ],
  },
  {
    id: 'salesman_poach', season: 3, day: 18,
    eyebrow: 'Market news', title: 'Poaching the sales clerk',
    text: 'A competitor wants to poach your sales clerk at the construction yard. If they leave, purchases will get more expensive for the whole season.',
    options: [
      {
        label: 'Do nothing', hint: 'yard prices +5% for the season',
        effect: { seasonPriceBonus: 0.05 },
        outcome: 'The clerk moved to the competitor. Yard prices went up 5%.',
      },
      {
        label: 'Gift cognac and hint at contracts — $10,000', hint: '−$10,000 · needs 65 reputation',
        requiresReputation: 65,
        effect: { cash: -10_000 },
        outcome: 'The clerk stayed and got a hint of future orders. Prices stay the same.',
      },
    ],
  },
  {
    id: 'loader_breakdown', season: 3, day: 31,
    eyebrow: 'Call from the yard', title: 'Broken forklift',
    text: 'The forklift at the yard broke down: the gearbox failed. You can buy the parts right away or wait several days for the delivery.',
    options: [
      {
        label: 'Buy the parts — $20,000', hint: '−$20,000',
        effect: { cash: -20_000 },
        outcome: 'The forklift is back in service today.',
      },
      {
        label: 'Wait for the delivery', hint: '+3 days to all deadlines',
        effect: { delayDays: 3 },
        outcome: 'The parts took three days to arrive — loading stood still.',
      },
    ],
  },
  {
    id: 'bad_concrete', season: 4, day: 9,
    eyebrow: 'From the construction site', title: 'Substandard concrete',
    text: 'One of the projects received low-quality concrete: the grade is below what was ordered. It cannot be poured without a decision.',
    options: [
      {
        label: 'Reorder — $70,000', hint: '−$70,000',
        effect: { cash: -70_000 },
        outcome: 'A fresh batch is on site, the foundation meets the standards.',
      },
      {
        label: 'Pour it as is', hint: '−15 reputation',
        effect: { reputation: -15 },
        outcome: 'A foundation of doubtful quality — rumors spread across the city, reputation dropped.',
      },
    ],
  },
  {
    id: 'inspector_visit', season: 4, day: 29,
    eyebrow: 'State construction supervision', title: 'Site inspection',
    text: 'A government inspector found issues in the as-built documentation. Fix them right away or settle the matter on the spot.',
    options: [
      {
        label: 'Fix the issues — $45,000', hint: '−$45,000',
        effect: { cash: -45_000 },
        outcome: 'The documentation is in order, the order is closed.',
      },
      {
        label: 'Settle it on the spot', hint: '−10 reputation',
        effect: { reputation: -10 },
        outcome: 'The matter was closed, but the inspection story reached the competitors.',
      },
    ],
  },
  {
    id: 'power_outage', season: 5, day: 22,
    eyebrow: 'Emergency services', title: 'Power line failure',
    text: 'The power line is down at the site — construction will stop until the electricity issue is resolved.',
    options: [
      {
        label: 'Rent a generator — $25,000', hint: '−$25,000',
        effect: { cash: -25_000 },
        outcome: 'A generator is on site and construction continues.',
      },
      {
        label: 'Wait for the line repair', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'The line was fixed in two days — the crew was waiting.',
      },
    ],
  },
  {
    id: 'fire_inspection', season: 6, day: 16,
    eyebrow: 'Fire inspector', title: 'Compliance order',
    text: 'A fire inspector came to the site: open flames and combustible waste near the material storage. A compliance order was issued.',
    options: [
      {
        label: 'Fix the violations — $45,000', hint: '−$45,000',
        effect: { cash: -45_000 },
        outcome: 'The site is cleaned up, the order is closed.',
      },
      {
        label: 'Ignore it', hint: '−10 reputation',
        effect: { reputation: -10 },
        outcome: 'A fine and bad press — reputation dropped.',
      },
    ],
  },
  {
    id: 'subbotnik', season: 6, day: 33,
    eyebrow: 'City hall', title: 'Community cleanup day',
    text: 'The district administration asks you to provide equipment and a crew for a park cleanup on Saturday. A good gesture for the city.',
    options: [
      {
        label: 'Help with equipment and people', hint: '+5 reputation',
        effect: { reputation: 5 },
        outcome: 'The city praised the company — reputation up.',
      },
      {
        label: 'Refuse', hint: '−5 reputation',
        effect: { reputation: -5 },
        outcome: 'The administration remembered the refusal: minus reputation.',
      },
    ],
  },
  {
    id: 'neighbors_noise', season: 7, day: 24,
    eyebrow: 'Local residents', title: 'Noise complaint',
    text: 'The neighboring building complains about night work. You can compensate the residents or keep on working as before.',
    options: [
      {
        label: 'Compensate the residents — $20,000', hint: '−$20,000',
        effect: { cash: -20_000 },
        outcome: 'The residents are happy, the issue is settled.',
      },
      {
        label: 'Keep on working as before', hint: '−6 reputation',
        effect: { reputation: -6 },
        outcome: 'The complaints reached the administration — minus reputation.',
      },
    ],
  },
  {
    id: 'warehouse_rent', season: 7, day: 36,
    eyebrow: 'Landlord', title: 'Warehouse rent',
    text: 'The landlord raised the rate for the material warehouse. Accept the new price or move to another warehouse.',
    options: [
      {
        label: 'Accept the new rate', hint: '−$50,000',
        effect: { cash: -50_000 },
        outcome: 'The contract is renewed and supplies run as usual.',
      },
      {
        label: 'Move to another warehouse', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'The move took two days — materials were received with a delay.',
      },
    ],
  },
  {
    id: 'park_sponsorship', season: 8, day: 31,
    eyebrow: 'City hall', title: 'Square landscaping',
    text: 'The city hall offers you to sponsor the landscaping of a city square. It will raise the company\'s standing.',
    options: [
      {
        label: 'Invest — $80,000', hint: '−$80,000 · +8 reputation',
        effect: { cash: -80_000, reputation: 8 },
        outcome: 'The company name is on the plaque at the square entrance: reputation up.',
      },
      {
        label: 'Refuse', hint: '−3 reputation',
        effect: { reputation: -3 },
        outcome: 'The city hall remembered the refusal: minus reputation.',
      },
    ],
  },
  {
    id: 'tax_audit', season: 9, day: 20,
    eyebrow: 'Tax inspectorate', title: 'Tax audit',
    text: 'The tax service scheduled a field audit. You can pay for a fast audit or go through the regular procedure.',
    options: [
      {
        label: 'Pay for the accelerated audit — $60,000', hint: '−$60,000',
        effect: { cash: -60_000 },
        outcome: 'The audit is closed in a day, the accounting department is calm.',
      },
      {
        label: 'Go through the regular procedure', hint: '+3 days to all deadlines',
        effect: { delayDays: 3 },
        outcome: 'Three days went to documents for the inspection — construction stood still.',
      },
    ],
  },
  {
    id: 'first_review', season: 0, day: 7,
    eyebrow: 'Review on the city portal', title: 'A flattering review',
    text: 'A client whose porch you built left a flattering review on the city portal.',
    options: [
      {
        label: 'Thank the client', hint: '+2 reputation',
        effect: { reputation: 2 },
        outcome: 'The review got noticed and the company became recognizable.',
      },
    ],
  },
  {
    id: 'dacha_season', season: 0, day: 20,
    eyebrow: 'Talk at the smoke break', title: 'Dacha season',
    text: 'The crew asks to let everyone off for the weekend — planting season, the wives insist. If you let them go, construction will stop.',
    options: [
      {
        label: 'Give a bonus and let them go', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'The crew rested and came back energized.',
      },
      {
        label: 'Refuse, but pay a bonus — $30,000', hint: '−$30,000',
        effect: { cash: -30_000 },
        outcome: 'The crew grumbles but works.',
      },
    ],
  },
  {
    id: 'wage_advance', season: 1, day: 7,
    eyebrow: 'The foreman\'s office', title: 'Advance to the workers',
    text: 'The foreman asks to hand out an advance to the whole crew by the end of the week — people have family plans and need money.',
    options: [
      {
        label: 'Hand out the advance — $25,000', hint: '−$25,000',
        effect: { cash: -25_000 },
        outcome: 'The crew is happy and works more eagerly.',
      },
      {
        label: 'Move it to payday', hint: '+1 day to all deadlines',
        effect: { delayDays: 1 },
        outcome: 'The displeased crew worked slower.',
      },
    ],
  },
  {
    id: 'drone_filming', season: 1, day: 38,
    eyebrow: 'Request from a blogger', title: 'Drone filming',
    text: 'A city blogger wants to film your construction process for their channel. It is free advertising, but the filming will distract the workers.',
    options: [
      {
        label: 'Allow the filming', hint: '+2 reputation · +1 day to deadlines',
        effect: { reputation: 2, delayDays: 1 },
        outcome: 'The video got views, work stopped briefly.',
      },
      {
        label: 'Refuse', hint: '−3 reputation',
        effect: { reputation: -3 },
        outcome: 'The blogger told about the refusal — reputation suffered.',
      },
    ],
  },
  {
    id: 'wrong_shipment', season: 2, day: 13,
    eyebrow: 'Receiving at the yard', title: 'Swapped delivery',
    text: 'The supplier brought the wrong insulation: only the pallet marking matches. Have them bring the right one or return the batch?',
    options: [
      {
        label: 'Accept with a surcharge — $120,000', hint: '−$120,000',
        effect: { cash: -120_000 },
        outcome: 'The supplier delivered the right material by evening.',
      },
      {
        label: 'Refuse the batch', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'Waited two days for the re-delivery.',
      },
    ],
  },
  {
    id: 'eco_fine', season: 2, day: 38,
    eyebrow: 'Environmental inspection', title: 'Fuel spill',
    text: 'A tractor driver drained leftover diesel into the ground near the site. An ecologist arrived and demands the cleanup.',
    options: [
      {
        label: 'Pay for the cleanup — $35,000', hint: '−$35,000',
        effect: { cash: -35_000 },
        outcome: 'The soil was removed, no orders issued.',
      },
      {
        label: 'Contest it', hint: '−6 reputation',
        effect: { reputation: -6 },
        outcome: 'The case ended up in the district news roundup.',
      },
    ],
  },
  {
    id: 'client_change', season: 3, day: 9,
    eyebrow: 'Call from the client', title: 'Replanning',
    text: 'The client asks to add a window in a load-bearing wall — and is ready to pay extra, but the handover will be pushed back.',
    options: [
      {
        label: 'Agree', hint: '+2 days to deadlines · +$50,000',
        effect: { cash: 50_000, delayDays: 2 },
        outcome: 'The client is happy, the handover moved back by two days.',
      },
      {
        label: 'Refuse', hint: '−4 reputation',
        effect: { reputation: -4 },
        outcome: 'The client was unhappy and told their friends.',
      },
    ],
  },
  {
    id: 'garbage_mountain', season: 3, day: 33,
    eyebrow: 'Neighbors\' complaint', title: 'Mountain of trash',
    text: 'A mountain of construction waste grew near the site — the administration demands it be hauled away by the end of the week.',
    options: [
      {
        label: 'Pay for the removal — $20,000', hint: '−$20,000',
        effect: { cash: -20_000 },
        outcome: 'The site is clean, no complaints.',
      },
      {
        label: 'Clean up with the crew', hint: '+1 day to all deadlines',
        effect: { delayDays: 1 },
        outcome: 'The crew cleared the trash in a day.',
      },
    ],
  },
  {
    id: 'documents_delay', season: 4, day: 18,
    eyebrow: 'Project approval', title: 'Delayed documents',
    text: 'The client is slow to hand over the permit documents, and without them the project cannot be delivered.',
    options: [
      {
        label: 'Speed it up through the archive — $30,000', hint: '−$30,000',
        effect: { cash: -30_000 },
        outcome: 'The documents arrived the same day.',
      },
      {
        label: 'Wait for the client', hint: '+3 days to all deadlines',
        effect: { delayDays: 3 },
        outcome: 'The documents were waited for three days.',
      },
    ],
  },
  {
    id: 'snow_help', season: 5, day: 9,
    eyebrow: 'Appeal from the district office', title: 'Clearing the yards',
    text: 'After a heavy snowfall the district office asks you to spare an excavator to clear school yards.',
    options: [
      {
        label: 'Help with equipment', hint: '+4 reputation',
        effect: { reputation: 4 },
        outcome: 'The schools thanked the company in the local news.',
      },
      {
        label: 'Refuse — equipment is needed on sites', hint: '−4 reputation',
        effect: { reputation: -4 },
        outcome: 'The district office remembered the refusal.',
      },
    ],
  },
  {
    id: 'cold_cabins', season: 5, day: 33,
    eyebrow: 'Frost at the site', title: 'Freezing cabins',
    text: 'The heaters in the site cabins broke down — the workers refuse to live on site until they are replaced.',
    options: [
      {
        label: 'Buy heaters — $25,000', hint: '−$25,000',
        effect: { cash: -25_000 },
        outcome: 'The cabins are warm and the crew stays.',
      },
      {
        label: 'Bear with it until the end of the week', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'Work went on in short shifts.',
      },
    ],
  },
  {
    id: 'heat_wave', season: 6, day: 7,
    eyebrow: 'Summer heat', title: 'Heat at the site',
    text: 'The thermometer climbed above +35°. The builders ask for water and earlier shifts.',
    options: [
      {
        label: 'Hire a water carrier — $15,000', hint: '−$15,000',
        effect: { cash: -15_000 },
        outcome: 'The crew works at a comfortable pace.',
      },
      {
        label: 'Cut the day shifts', hint: '+1 day to all deadlines',
        effect: { delayDays: 1 },
        outcome: 'Work went on only in the morning and evening.',
      },
    ],
  },
  {
    id: 'tv_report', season: 6, day: 27,
    eyebrow: 'Call from the TV channel', title: 'Journalists at the site',
    text: 'A local TV channel is preparing a story on residential construction and wants to show your site.',
    options: [
      {
        label: 'Give an interview and host the filming', hint: '+4 reputation · +1 day to deadlines',
        effect: { reputation: 4, delayDays: 1 },
        outcome: 'The story aired in the evening, a day went to filming.',
      },
      {
        label: 'Refuse the filming', hint: '−6 reputation',
        effect: { reputation: -6 },
        outcome: 'The TV channel showed the competitors.',
      },
    ],
  },
  {
    id: 'extra_floor', season: 7, day: 11,
    eyebrow: 'Client\'s request', title: 'An extra floor without permits',
    text: 'The client asks to add a floor without obtaining permits: "no one will notice". It is a risk for the company.',
    options: [
      {
        label: 'Take the extra payment', hint: '+$500,000 · −2 reputation',
        effect: { cash: 500_000, reputation: -2 },
        outcome: 'The money came in, but the story reached construction supervision.',
      },
      {
        label: 'Refuse', hint: '−15 reputation',
        effect: { reputation: -15 },
        outcome: 'The client left displeased and spread rumors.',
      },
    ],
  },
  {
    id: 'city_order', season: 8, day: 18,
    eyebrow: 'Offer from the city hall', title: 'City order with an advance',
    text: 'The city hall offers a small project for the city with full advance payment. Money right away, but you will have to fit its schedule in.',
    options: [
      {
        label: 'Take the order', hint: '+$150,000 · +2 days to deadlines',
        effect: { cash: 150_000, delayDays: 2 },
        outcome: 'The advance arrived and the project deadlines shifted.',
      },
      {
        label: 'Refuse — you are busy', hint: '−5 reputation',
        effect: { reputation: -5 },
        outcome: 'The city hall remembered the refusal.',
      },
    ],
  },
  {
    id: 'holiday_deadline', season: 9, day: 9,
    eyebrow: 'Client\'s request', title: 'Handover before the holiday',
    text: 'A client wants to move in for a family holiday and asks to deliver the project early, promising a bonus.',
    options: [
      {
        label: 'Arrange overtime — $50,000', hint: '−$50,000 · +5 reputation',
        effect: { cash: -50_000, reputation: 5 },
        outcome: 'The project was delivered on time and the client is thrilled.',
      },
      {
        label: 'Stay on schedule', hint: '−3 reputation',
        effect: { reputation: -3 },
        outcome: 'The client is upset, the review is restrained.',
      },
    ],
  },
  {
    id: 'first_client', season: 0, day: 4,
    eyebrow: 'The porch client', title: 'The first estimate',
    text: 'Your first client asks you to "show the math on paper": they doubt a couple of line items. Walk through the estimate with them or take it as is?',
    options: [
      {
        label: 'Walk through the estimate item by item', hint: '−$10,000',
        effect: { cash: -10_000 },
        outcome: 'The client liked the transparency and signed the contract.',
      },
      {
        label: 'It is a standard estimate', hint: '−2 reputation',
        effect: { reputation: -2 },
        outcome: 'The client compared it with competitors\' numbers and left to think.',
      },
    ],
  },
  {
    id: 'wife_first', season: 0, day: 27,
    eyebrow: 'An evening at home', title: 'Wedding anniversary',
    text: 'Your wife reminds you: it is your wedding anniversary, and you are late at the site again. Spend the evening with the family or work until night?',
    options: [
      {
        label: 'Spend the evening at home', hint: '+2 reputation',
        effect: { reputation: 2 },
        outcome: 'The family is calm and tomorrow works with renewed energy.',
      },
      {
        label: 'Stay at the site', hint: '−2 reputation',
        effect: { reputation: -2 },
        outcome: 'Your wife is hurt, and home became quiet and cold.',
      },
    ],
  },
  {
    id: 'frozen_ground', season: 1, day: 4,
    eyebrow: 'Frost at the site', title: 'Frozen pit',
    text: 'The ground froze to more than a meter deep: the breakers take twice as long on every cubic yard.',
    options: [
      {
        label: 'Rent a ground heater — $60,000', hint: '−$60,000',
        effect: { cash: -60_000 },
        outcome: 'The ground thawed and the pit is back on schedule.',
      },
      {
        label: 'Work by hand', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'The pit was dug over two extra days.',
      },
    ],
  },
  {
    id: 'plumber_burst', season: 1, day: 18,
    eyebrow: 'Accident at the site', title: 'Heating burst',
    text: 'A pipe burst in the cabin and the radiators went cold across the sites. Fix it urgently or wait out the frost?',
    options: [
      {
        label: 'Call the emergency service — $25,000', hint: '−$25,000',
        effect: { cash: -25_000 },
        outcome: 'Heat is back and work never stopped.',
      },
      {
        label: 'Bear with it in jackets', hint: '+1 day to all deadlines',
        effect: { delayDays: 1 },
        outcome: 'The crew spent a day warming up instead of building.',
      },
    ],
  },
  {
    id: 'snow_storm', season: 1, day: 22,
    eyebrow: 'Weather forecast', title: 'Blizzard approaching',
    text: 'Forecasters promise a three-day blizzard. Stock up on salt and tarps or rely on luck?',
    options: [
      {
        label: 'Buy salt and tarps — $20,000', hint: '−$20,000',
        effect: { cash: -20_000 },
        outcome: 'The blizzard passed and the sites hardly idled.',
      },
      {
        label: 'Rely on the weather', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'The sites were snowed in for two days.',
      },
    ],
  },
  {
    id: 'winter_clothes', season: 1, day: 31,
    eyebrow: 'Workers\' complaint', title: 'Winter gear',
    text: 'The crew refuses to work in summer gear: not ready for this weather. Only warm outfits will help.',
    options: [
      {
        label: 'Hand out winter kits — $45,000', hint: '−$45,000',
        effect: { cash: -45_000 },
        outcome: 'The crew is warm and works at full strength.',
      },
      {
        label: 'Bear with it until the season change', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'The chilled crew worked twice as slowly.',
      },
    ],
  },
  {
    id: 'rival_poach', season: 2, day: 9,
    eyebrow: 'Market news', title: 'Client poaching',
    text: 'A competitor\'s director is calling your clients and offering a 10% discount to switch.',
    options: [
      {
        label: 'Keep them with a bonus — $40,000', hint: '−$40,000',
        effect: { cash: -40_000 },
        outcome: 'The client stayed with you and the competitor backed off.',
      },
      {
        label: 'Do not join the price wars', hint: '−3 reputation',
        effect: { reputation: -3 },
        outcome: 'One client left, the rest now think about prices.',
      },
    ],
  },
  {
    id: 'supplier_blacklist', season: 2, day: 20,
    eyebrow: 'Construction yard', title: 'Competitor\'s priority',
    text: 'A competitor talked the yard manager into loading their batches first. Your orders keep getting pushed back.',
    options: [
      {
        label: 'Settle it with the manager — $50,000', hint: '−$50,000',
        effect: { cash: -50_000 },
        outcome: 'The queue is restored and deliveries are on time again.',
      },
      {
        label: 'Wait your turn', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'For two days the materials arrived late.',
      },
    ],
  },
  {
    id: 'market_dumping', season: 2, day: 31,
    eyebrow: 'Job board', title: 'Price dumping',
    text: 'Competitors took several contracts clearly below cost — just to take over the job board.',
    options: [
      {
        label: 'Cut prices by 5%', hint: '−$50,000',
        effect: { cash: -50_000 },
        outcome: 'The board is still yours, but the margins have thinned.',
      },
      {
        label: 'Ignore the dumping', hint: '−3 reputation',
        effect: { reputation: -3 },
        outcome: 'Clients started saying the competitors are cheaper.',
      },
    ],
  },
  {
    id: 'tender_city', season: 3, day: 24,
    eyebrow: 'Administration', title: 'City tender',
    text: 'The city is running a tender for a school renovation. The application is expensive, but winning it would cover a whole season of orders.',
    requiresLicense: 'city',
    options: [
      {
        label: 'Submit the application — $100,000', hint: '−$100,000 · +4 reputation',
        effect: { cash: -100_000, reputation: 4 },
        outcome: 'The tender is won — the company is talked about across the district.',
      },
      {
        label: 'Skip the tender', hint: '−2 reputation',
        effect: { reputation: -2 },
        outcome: 'The contract went to a competitor and strengthened their position.',
      },
    ],
  },
  {
    id: 'crew_raid', season: 3, day: 38,
    eyebrow: 'Rumor at the site', title: 'Poaching your people',
    text: 'A competitor offers your best workers a wage and a half higher plus transport to their site.',
    options: [
      {
        label: 'Raise the bonuses — $80,000', hint: '−$80,000',
        effect: { cash: -80_000 },
        outcome: 'The people stayed; there is nobody to say goodbye to.',
      },
      {
        label: 'Do not give in to extortion', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'Two workers quit — while finding replacements, construction stood still.',
      },
    ],
  },
  {
    id: 'family_budget', season: 4, day: 4,
    eyebrow: 'Talk over dinner', title: 'A friend\'s failing business',
    text: 'Your wife invested in a friend\'s failing business and is now worried: the venture is sinking, and she will not break with her friend.',
    options: [
      {
        label: 'Cover the debt and ban the friendship', hint: '−$200,000',
        effect: { cash: -200_000 },
        outcome: 'The debt is paid, the friend is hurt, and your wife dislikes the decision.',
      },
      {
        label: 'Buy out the business', hint: '−$600,000 · +2 reputation',
        effect: { cash: -600_000, reputation: 2 },
        outcome: 'The business is yours, the losses are yours too, but family peace is saved.',
      },
    ],
  },
  {
    id: 'client_steal', season: 4, day: 13,
    eyebrow: 'Call from the client', title: 'Competitors\' offer',
    text: 'The client reports: competitors quoted 15% less. Negotiate a discount or let them go?',
    options: [
      {
        label: 'Cut 10% off the contract', hint: '−$60,000',
        effect: { cash: -60_000 },
        outcome: 'The client stayed; the recalculation took a day.',
      },
      {
        label: 'Work at the contract price', hint: '−4 reputation',
        effect: { reputation: -4 },
        outcome: 'The client left and told friends about the greedy company.',
      },
    ],
  },
  {
    id: 'rival_ad', season: 4, day: 24,
    eyebrow: 'Advertising', title: 'Competitor banners',
    text: 'Competitors put up banners downtown and launched radio spots. You are nowhere to be seen or heard.',
    options: [
      {
        label: 'Launch your own campaign — $90,000', hint: '−$90,000 · +4 reputation',
        effect: { cash: -90_000, reputation: 4 },
        outcome: 'People started recognizing you — requests came right after the airing.',
      },
      {
        label: 'Do not chase advertising', hint: '−3 reputation',
        effect: { reputation: -3 },
        outcome: 'The city only talks about the competitor.',
      },
    ],
  },
  {
    id: 'bidding_war', season: 4, day: 38,
    eyebrow: 'Construction yard', title: 'Scarce rebar',
    text: 'A scarce batch of rebar arrived at the yard and the competitors are already queuing for it.',
    options: [
      {
        label: 'Buy out the whole batch — $250,000', hint: '−$250,000',
        effect: { cash: -250_000 },
        outcome: 'The rebar is yours — in mid-season that beats cash.',
      },
      {
        label: 'Give up your place in line', hint: '+3 days to all deadlines',
        effect: { delayDays: 3 },
        outcome: 'Finding another supplier took three days.',
      },
    ],
  },
  {
    id: 'insurance', season: 5, day: 2,
    eyebrow: 'Insurance agent', title: 'Industrial risk policy',
    text: 'An agent offers to insure your projects against fire and flooding: expensive, but peaceful.',
    options: [
      {
        label: 'Take the policy — $80,000', hint: '−$80,000',
        effect: { cash: -80_000 },
        outcome: 'Risks are covered, nights are calmer.',
      },
      {
        label: 'Do without insurance', hint: '−3 reputation',
        effect: { reputation: -3 },
        outcome: 'A neighbor\'s warehouse burned — the uninsured rating went down.',
      },
    ],
  },
  {
    id: 'investor_offer', season: 5, day: 16,
    eyebrow: 'Finance club', title: 'An investor joins',
    text: 'A private investor offers to pour 10 million into the company for a stake and a board seat.',
    options: [
      {
        label: 'Take the investor\'s money', hint: '+$2,000,000 · +15% order deadlines until the end of season',
        effect: { cash: 2_000_000, seasonDeadlineBonus: 0.15 },
        outcome: 'The money is in the account, but the investor watches every estimate.',
      },
      {
        label: 'Stay independent', hint: '+2 reputation',
        effect: { reputation: 2 },
        outcome: 'The market respects companies without outside money.',
      },
    ],
  },
  {
    id: 'union_contract', season: 5, day: 38,
    eyebrow: 'Trade union', title: 'Collective agreement',
    text: 'The crew asks to sign an agreement with fixed bonuses for years of service.',
    options: [
      {
        label: 'Sign the agreement — $90,000', hint: '−$90,000',
        effect: { cash: -90_000 },
        outcome: 'Turnover dropped and the crews are in order.',
      },
      {
        label: 'Refuse', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'The workers dragged their feet at lunch — construction ran at half speed.',
      },
    ],
  },
  {
    id: 'bank_credit_line', season: 6, day: 2,
    eyebrow: 'Partner bank', title: 'Credit line',
    text: 'The bank offers a revolving line secured by equipment: money on demand, interest once a month.',
    options: [
      {
        label: 'Open the line', hint: '+$500,000',
        effect: { cash: 500_000 },
        outcome: 'A safety cushion appeared, but the interest keeps ticking.',
      },
      {
        label: 'Live within your means', hint: '+2 reputation',
        effect: { reputation: 2 },
        outcome: 'Bankers appreciate careful clients.',
      },
    ],
  },
  {
    id: 'new_office', season: 6, day: 11,
    eyebrow: 'Office move', title: 'An office downtown',
    text: 'An office downtown became available: prestigious, but expensive. Keep the old office or move?',
    options: [
      {
        label: 'Rent the downtown office — $70,000', hint: '−$70,000 · +3 reputation',
        effect: { cash: -70_000, reputation: 3 },
        outcome: 'Clients now come to you — the status works.',
      },
      {
        label: 'Save up for your own building', hint: '−1 reputation',
        effect: { reputation: -1 },
        outcome: 'The old office is still around the corner, but there are plenty of plans.',
      },
    ],
  },
  {
    id: 'subcontractor', season: 6, day: 20,
    eyebrow: 'Offer from a partner', title: 'Outsourcing the finishing',
    text: 'A finishing crew offers to take the finishing of your projects on a subcontract — faster, but the contractors must be paid.',
    options: [
      {
        label: 'Take the subcontractors — $70,000', hint: '−$70,000',
        effect: { cash: -70_000 },
        outcome: 'The projects sped up — control stayed with you.',
      },
      {
        label: 'Only with your own crew', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'Your crew pulls through, but the deadlines are stretching.',
      },
    ],
  },
  {
    id: 'city_contract', season: 7, day: 7,
    eyebrow: 'City hall', title: 'Regional contract',
    text: 'The region offers a contract for a housing settlement for doctors: advance right away, but the price is frozen for years.',
    options: [
      {
        label: 'Take the project', hint: '+$1,000,000 · +2 days to deadlines',
        effect: { cash: 1_000_000, delayDays: 2 },
        outcome: 'The advance arrived, the schedule moved, the name is on the city maps.',
      },
      {
        label: 'Refuse', hint: '−10 reputation',
        effect: { reputation: -10 },
        outcome: 'The region remembered the refusal.',
      },
    ],
  },
  {
    id: 'wife_vacation', season: 7, day: 16,
    eyebrow: 'Summer plans', title: 'The long-awaited vacation',
    text: 'Your wife reminds you: the seaside vacation was promised back in spring. The crew stays with the senior foreman.',
    options: [
      {
        label: 'Leave for two weeks', hint: '−$60,000 · +2 reputation',
        effect: { cash: -60_000, reputation: 2 },
        outcome: 'The vacation was great, the senior foreman managed without you.',
      },
      {
        label: 'Postpone the vacation', hint: '−2 reputation',
        effect: { reputation: -2 },
        outcome: 'Your wife stares silently at the wall, but you are at the site.',
      },
    ],
  },
  {
    id: 'pr_campaign', season: 7, day: 20,
    eyebrow: 'Marketing', title: 'Articles about the company',
    text: 'An editor of a city magazine offers a series of articles about your projects — at a reasonable price.',
    options: [
      {
        label: 'Order the article series — $120,000', hint: '−$120,000 · +5 reputation',
        effect: { cash: -120_000, reputation: 5 },
        outcome: 'After the publications the phone was red-hot with requests.',
      },
      {
        label: 'Do without PR', hint: '−2 reputation',
        effect: { reputation: -2 },
        outcome: 'The magazine wrote about the competitors, not about you.',
      },
    ],
  },
  {
    id: 'takeover_offer', season: 7, day: 31,
    eyebrow: 'Call from a holding', title: 'Takeover offer',
    text: 'A capital holding offers to buy the controlling stake: you stay on as director, but you no longer make the decisions.',
    options: [
      {
        label: 'Sell 51%', hint: '+$3,000,000 · −5 reputation',
        effect: { cash: 3_000_000, reputation: -5 },
        outcome: 'The money came in, but the market thinks you sold out.',
      },
      {
        label: 'Stay independent', hint: '+4 reputation',
        effect: { reputation: 4 },
        outcome: 'You stayed independent — and the city respects it.',
      },
    ],
  },
  {
    id: 'corp_announce', season: 8, day: 1,
    eyebrow: 'Market rumors', title: 'Alliance enters the market',
    text: 'A federal player showed up in town this morning: the Alliance corporation is opening a regional branch. Word is their budget beats yours, with four sites at once and their own HR services. On other markets they crush everyone.',
    options: [
      {
        label: 'Look around and keep working', hint: 'Keep an eye on the market',
        effect: {},
        outcome: 'Alliance opened its branch. Soon there will be fewer orders and harsher prices.',
      },
    ],
  },
  {
    id: 'corp_dumping_season', season: 8, day: 13,
    eyebrow: 'Job board', title: 'The corporation\'s rules',
    text: 'Alliance takes orders in bundles at dumped prices and pushes prices down at the yards. Your quotes keep losing.',
    options: [
      {
        label: 'Compete on quality', hint: '−$750,000 · +3 reputation',
        effect: { cash: -750_000, reputation: 3 },
        outcome: 'Clients pick you for reliability, not for price.',
      },
      {
        label: 'Cut your prices', hint: '−$350,000',
        effect: { cash: -350_000 },
        outcome: 'Orders are there, profit is not — dumping is expensive.',
      },
    ],
  },
  {
    id: 'corp_recruit', season: 8, day: 29,
    eyebrow: 'Job exchange', title: 'A HR reshuffle',
    text: 'Alliance offers your best workers twice the wage — and no probation period.',
    options: [
      {
        label: 'Raise the wages', hint: 'all crews\' wages +30% until the end of season',
        effect: { seasonWageBonus: 0.3 },
        outcome: 'The crews stayed, but the payroll has grown noticeably.',
      },
      {
        label: 'Let them try to leave', hint: '+2 days to all deadlines',
        effect: { delayDays: 2 },
        outcome: 'While replacements were found, two projects stood still.',
      },
    ],
  },
  {
    id: 'corp_war_price', season: 9, day: 7,
    eyebrow: 'Construction yards', title: 'Buying up the leftovers',
    text: 'Alliance is buying up the remaining stock at North and South, leaving you small batches at inflated prices.',
    options: [
      {
        label: 'Find your own carrier', hint: '−$500,000',
        effect: { cash: -500_000 },
        outcome: 'Your own haulage covers the shortages at the yards.',
      },
      {
        label: 'Wait for stabilization', hint: '+3 days to all deadlines',
        effect: { delayDays: 3 },
        outcome: 'For three days the materials arrived with interruptions.',
      },
    ],
  },
  {
    id: 'corp_agreement', season: 9, day: 24,
    eyebrow: 'Alliance office', title: 'Under the corporation\'s wing',
    text: 'The corporation offers to become its regional subcontractor: steady orders, but prices and schedules are theirs to dictate.',
    options: [
      {
        label: 'Accept the partnership', hint: '+$800,000 · −4 reputation',
        effect: { cash: 800_000, reputation: -4 },
        outcome: 'Orders are steady, but the region whispers: "he caved".',
      },
      {
        label: 'Stay a competitor', hint: '+5 reputation',
        effect: { reputation: 5 },
        outcome: 'The only real rival to Alliance in the region is you.',
      },
    ],
  },
  {
    id: 'corp_final', season: 9, day: 38,
    eyebrow: 'Season finale', title: 'Takeover offer',
    text: 'Right before the finale, Alliance offers to buy the whole company — a very good price. Refusing will most likely start a price war.',
    options: [
      {
        label: 'Sell the company', hint: '+$20,000,000',
        effect: { cash: 20_000_000 },
        outcome: 'A huge pile of money on the account, but the company is no longer yours.',
      },
      {
        label: 'Stay and fight', hint: '+15 reputation',
        effect: { reputation: 15 },
        outcome: 'The region will remember: Alliance did not buy everyone.',
      },
    ],
  },
  {
    id: 'corp_final_sold', season: 9, day: 39,
    eyebrow: 'Deal closed', title: 'A dream betrayed',
    text: 'The signature is on the contract: the company Balder Bob had been building for ten seasons has become part of Alliance. The money is in the account, but in the morning no construction site is waiting for him. The dream has been sold.',
    when: (state) => state.corpFinalChoice === 'sold',
    options: [
      {
        label: 'Understood', hint: '—',
        effect: {},
        outcome: 'The company was sold. The game continues in free mode.',
      },
    ],
  },
  {
    id: 'corp_final_fight', season: 9, day: 39,
    eyebrow: 'Finale', title: 'A true shark',
    text: 'You refused to sell your dream. Alliance backed off — the city will remember that this foreman did not surrender. The company is independent, the order book is in your hands, and the final push lies ahead. Balder Bob, you are a true builder of your own destiny!',
    when: (state) => state.corpFinalChoice === 'fight',
    options: [
      {
        label: 'Accepted', hint: '—',
        effect: {},
        outcome: 'Fight to the end ahead. Good luck!',
      },
    ],
  },
]

export function eventById(id: string): EventDef {
  return EVENTS.find((event) => event.id === id)!
}