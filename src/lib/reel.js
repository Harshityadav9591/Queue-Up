// Titles cued on the landing page and the sign-in wall. Real TMDB records, kept here so those pages
// never wait on the API (and still look right without a key).
export const REEL = {
  movie: [
    { id: 693134, title: 'Dune: Part Two', year: '2024', length: '2h 46m', poster: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', backdrop: '/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg' },
    { id: 496243, title: 'Parasite', year: '2019', length: '2h 13m', poster: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', backdrop: '/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg' },
    { id: 129, title: 'Spirited Away', year: '2001', length: '2h 5m', poster: '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', backdrop: '/bSXfU4dwZyBA1vMmXvejdRXBvuF.jpg' },
    { id: 157336, title: 'Interstellar', year: '2014', length: '2h 49m', poster: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', backdrop: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg' },
    { id: 545611, title: 'Everything Everywhere All at Once', year: '2022', length: '2h 20m', poster: '/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg', backdrop: '/ss0Os3uWJfQAENILHZUdX8Tt1OC.jpg' },
    { id: 872585, title: 'Oppenheimer', year: '2023', length: '3h 1m', poster: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', backdrop: '/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg' },
    { id: 792307, title: 'Poor Things', year: '2023', length: '2h 21m', poster: '/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg', backdrop: '/bQS43HSLZzMjZkcHJz4fGc7fNdz.jpg' },
    { id: 569094, title: 'Across the Spider-Verse', year: '2023', length: '2h 20m', poster: '/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', backdrop: '/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg' },
  ],
  tv: [
    { id: 209867, title: 'Frieren', year: '2023', length: '28 episodes', poster: '/dqZENchTd7lp5zht7BdlqM7RBhD.jpg', backdrop: '/96RT2A47UdzWlUfvIERFyBsLhL2.jpg' },
    { id: 95396, title: 'Severance', year: '2022', length: '19 episodes', poster: '/lFf6LLrQjYldcZItzOkGmMMigP7.jpg', backdrop: '/npD65vPa4vvn1ZHpp3o05A5vdKT.jpg' },
    { id: 1396, title: 'Breaking Bad', year: '2008', length: '62 episodes', poster: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', backdrop: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg' },
    { id: 94605, title: 'Arcane', year: '2021', length: '18 episodes', poster: '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg', backdrop: '/q8eejQcg1bAqImEV8jh8RtBD4uH.jpg' },
    { id: 70523, title: 'Dark', year: '2017', length: '26 episodes', poster: '/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg', backdrop: '/3lBDg3i6nn5R2NKFCJ6oKyUo2j5.jpg' },
    { id: 87108, title: 'Chernobyl', year: '2019', length: '5 episodes', poster: '/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg', backdrop: '/20eIP9o5ebArmu2HxJutaBjhLf4.jpg' },
    { id: 100088, title: 'The Last of Us', year: '2023', length: '16 episodes', poster: '/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg', backdrop: '/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg' },
    { id: 1429, title: 'Attack on Titan', year: '2013', length: '89 episodes', poster: '/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg', backdrop: '/rqbCbjB19amtOtFQbb3K2lgm2zv.jpg' },
  ],
};

export const tmdbImage = (path, size = 'w500') => `https://image.tmdb.org/t/p/${size}${path}`;
