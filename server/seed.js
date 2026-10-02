// Default data written to server/data/db.json on first run.
// Delete db.json to reset the site to these defaults.

const day = 24 * 60 * 60 * 1000;
const now = Date.now();
const img = (name) => `/images/${name}.jpg`; // photos in public/images (credits in CREDITS.txt)

module.exports = {
  categories: [
    { id: 'aerial', name: 'Aerial', icon: '🏗️' },
    { id: 'backhoes', name: 'Backhoes', icon: '🚜' },
    { id: 'aviation', name: 'Aviation Surplus', icon: '✈️' },
    { id: 'earthmoving', name: 'Earthmoving', icon: '⛏️' },
    { id: 'dozers', name: 'Dozers', icon: '🚧' },
    { id: 'cranes', name: 'Cranes', icon: '🏗️' },
    { id: 'trucks', name: 'Trucks', icon: '🚚' }
  ],

  auctions: [
    { id: 1, title: '2019 Freightliner Cascadia T/A Sleeper Truck Tractor Detroit DD15', category: 'trucks', location: 'Delhi, DL', image: img('freightliner-cascadia'), startingBid: 13200000, currentBid: 14520000, bidCount: 14, endsAt: now + 3 * day, year: 2019, hours: '412,000 mi', description: 'Detroit DD15 engine, DT12 automated transmission, 72" raised-roof sleeper, air ride suspension. Well maintained fleet unit with service records.' },
    { id: 2, title: '2018 Peterbilt 579 Tandem Axle Flatbed Tractor Cummins X15', category: 'trucks', location: 'Ludhiana, PB', image: img('peterbilt-579'), startingBid: 7920000, currentBid: 8668000, bidCount: 9, endsAt: now + 4 * day, year: 2018, hours: '508,300 mi', description: 'Cummins X15, 13-speed manual, 24.5" aluminium wheels, new front tyres. Clean title.' },
    { id: 3, title: '2017 Volvo A40G Articulated Dump Truck 6x6', category: 'earthmoving', location: 'Mumbai, MH', image: img('volvo-a40g'), startingBid: 18480000, currentBid: 20944000, bidCount: 21, endsAt: now + 2 * day, year: 2017, hours: '9,850 hrs', description: '39-tonne capacity, tailgate, rear-view camera, auto lube. Undercarriage inspected.' },
    { id: 4, title: '2020 CAT 745 Articulated Hauler with Tailgate', category: 'earthmoving', location: 'Ahmedabad, GJ', image: img('cat-745'), startingBid: 26400000, currentBid: 27500000, bidCount: 7, endsAt: now + 5 * day, year: 2020, hours: '6,120 hrs', description: 'Cab with A/C, payload monitoring, stability assist. One-owner machine.' },
    { id: 5, title: '2016 CAT D6T XL Crawler Dozer with 6-Way Blade', category: 'dozers', location: 'Bengaluru, KA', image: img('cat-d6t'), startingBid: 10560000, currentBid: 11792000, bidCount: 12, endsAt: now + 6 * day, year: 2016, hours: '8,430 hrs', description: 'VPAT blade, ripper, enclosed cab, 60% undercarriage remaining.' },
    { id: 6, title: '2019 JCB 3CX 14 Super Backhoe Loader 4x4', category: 'backhoes', location: 'Pune, MH', image: img('jcb-3cx'), startingBid: 4840000, currentBid: 5385600, bidCount: 10, endsAt: now + 1.5 * day, year: 2019, hours: '3,210 hrs', description: 'Extendahoe, pilot controls, 4-in-1 bucket, quick coupler.' },
    { id: 7, title: '2018 Genie S-65 Telescopic Boom Lift 4WD', category: 'aerial', location: 'Hyderabad, TS', image: img('genie-s65'), startingBid: 3344000, currentBid: 3762000, bidCount: 8, endsAt: now + 3.5 * day, year: 2018, hours: '2,040 hrs', description: '65 ft platform height, diesel, oscillating axle, foam-filled tyres.' },
    { id: 8, title: '2015 Grove RT880E Rough Terrain Crane 80 Ton', category: 'cranes', location: 'Chennai, TN', image: img('grove-rt880e'), startingBid: 35200000, currentBid: 37400000, bidCount: 5, endsAt: now + 7 * day, year: 2015, hours: '7,760 hrs', description: '124 ft main boom, 56 ft swingaway jib, LMI, 4-wheel steer.' }
  ],

  testimonials: [
    { id: 1, name: 'Evelyn Simmons', role: 'Asset Manager, Northgate Equipment Finance', rating: 5, text: 'We began working with BidHaul in 2022 and the results have been nothing short of phenomenal. Their team makes remarketing our repossessed and lease-return assets effortless, and the online portal makes tracking every sale simple.' },
    { id: 2, name: 'Marcus Reed', role: 'Owner, Reed Funding Group', rating: 5, text: 'BidHaul has been our preferred remarketing partner for used equipment. Their responsiveness and quick turnaround on end-to-end sales have been consistent, and communication has been a pleasure throughout.' },
    { id: 3, name: 'Priya Nair', role: 'Fleet Director, Summit Municipal Services', rating: 5, text: 'Selling retired fleet vehicles used to take months. With BidHaul we list, inspect and close within weeks — and the final prices beat our expectations every time.' }
  ],

  partners: ['IRONCLAD', 'NORTHGATE', 'SUMMIT', 'TITAN LEASE', 'APEX FLEET', 'ROCKWELL'],

  news: [
    { id: 1, tag: 'Press Release', date: '2026-09-12', title: 'Buyers and sellers find solutions to limited heavy equipment supplies online', image: img('news-construction') },
    { id: 2, tag: 'Market Report', date: '2026-08-28', title: 'Used truck values stabilise as fleets refresh ahead of Q4', image: img('news-trucks') },
    { id: 3, tag: 'Guide', date: '2026-08-05', title: 'Five things to check before bidding on a used excavator', image: img('news-excavator') }
  ],

  users: [],
  bids: [],
  messages: [],
  subscribers: []
};
