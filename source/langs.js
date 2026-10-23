/* Languages: alphabets, letter rules, sample words and the small bits of page text. Pure data, no DOM.
   The 12 most spoken languages: English, Mandarin Chinese, Hindi, Spanish, French, Arabic, Bengali,
   Portuguese, Russian, Urdu, Indonesian, German. */
(function (root) {
  'use strict';

  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const w = (s) => s.split(/\s+/).filter(Boolean);

  // kind: 'alpha' one cell per letter (accents fold to base letters unless the letter is in the alphabet),
  //       'arabic' one cell per letter after normalising, 'han' one cell per character, 'indic' one cell per letter cluster.
  const LANGS = {
    en: { id: 'en', name: 'English', native: 'English', locale: 'en', kind: 'alpha', alphabet: AZ, glyph: 1, len: [4, 9],
      title: 'Word Search', sample: 'PLANET COMET GALAXY ORBIT ROCKET NEBULA SATURN LUNAR SOLAR ECLIPSE METEOR COSMOS' },
    zh: { id: 'zh', name: 'Chinese (Mandarin)', native: '中文', locale: 'zh', kind: 'han', glyph: 0.8, len: [2, 4], title: '找词游戏',
      filler: '的一是不了人我在有他这为之大来以个中上们到说国和地也子时道出而要于就下得可你年生自会那后能对着事其里所去行过家十用发天如然作方成者多日都三小军二无同么经法当起与好看学进种将还分此心前面又定见只主没公从',
      words: w('房子 小狗 小猫 大树 花朵 河流 高山 海滩 星星 月亮 太阳 白云 下雨 大风 火焰 大地 道路 桥梁 城市 村庄 花园 森林 岛屿 大海 天空 书本 桌子 椅子 窗户 门口 厨房 水果 面包 奶酪 牛奶 咖啡 学校 朋友 家庭 音乐') },
    hi: { id: 'hi', name: 'Hindi', native: 'हिन्दी', locale: 'hi', kind: 'indic', script: 'Devanagari', glyph: 0.78, len: [2, 5], title: 'शब्द खोज',
      filler: w('क ख ग घ च छ ज झ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह अ आ इ ई उ ऊ ए ऐ ओ औ का कि की कु के को मा मि ना नी पा रा ला सा हा'),
      words: w('घर कुत्ता बिल्ली पेड़ फूल नदी पहाड़ समुद्र तारा चाँद सूरज बादल बारिश हवा आग धरती रास्ता पुल शहर गाँव बगीचा जंगल द्वीप आकाश किताब मेज़ कुर्सी खिड़की दरवाज़ा रसोई फल रोटी पनीर दूध चाय स्कूल दोस्त परिवार संगीत') },
    es: { id: 'es', name: 'Spanish', native: 'Español', locale: 'es', kind: 'alpha', alphabet: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', glyph: 1, len: [4, 9], title: 'Sopa de letras',
      words: w('casa perro gato árbol flor río montaña playa estrella luna sol nube lluvia viento fuego tierra camino puente ciudad pueblo jardín bosque isla mar cielo libro mesa silla ventana puerta cocina fruta pan queso leche café escuela amigo familia música') },
    fr: { id: 'fr', name: 'French', native: 'Français', locale: 'fr', kind: 'alpha', alphabet: AZ, glyph: 1, len: [4, 9], title: 'Mots mêlés',
      words: w('maison chien chat arbre fleur rivière montagne plage étoile lune soleil nuage pluie vent feu terre chemin pont ville village jardin forêt île mer ciel livre table chaise fenêtre porte cuisine fruit pain fromage lait café école ami famille musique') },
    ar: { id: 'ar', name: 'Arabic', native: 'العربية', locale: 'ar', kind: 'arabic', rtl: true, alphabet: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي', glyph: 0.85, len: [3, 7], title: 'البحث عن الكلمات',
      map: { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ة': 'ه', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي' },
      words: w('بيت كلب قطة شجرة زهرة نهر جبل شاطئ نجمة قمر شمس غيمة مطر ريح نار أرض طريق جسر مدينة قرية حديقة غابة جزيرة بحر سماء كتاب طاولة كرسي نافذة باب مطبخ فاكهة خبز جبن حليب قهوة مدرسة صديق عائلة موسيقى') },
    bn: { id: 'bn', name: 'Bengali', native: 'বাংলা', locale: 'bn', kind: 'indic', script: 'Bengali', glyph: 0.78, len: [2, 5], title: 'শব্দ খোঁজা',
      filler: w('ক খ গ ঘ চ ছ জ ঝ ট ঠ ড ঢ ণ ত থ দ ধ ন প ফ ব ভ ম য র ল শ ষ স হ অ আ ই ঈ উ ঊ এ ঐ ও ঔ কা কি কী কে কো মা নি পা রা লা সা'),
      words: w('বাড়ি কুকুর বিড়াল গাছ ফুল নদী পাহাড় সমুদ্র তারা চাঁদ সূর্য মেঘ বৃষ্টি বাতাস আগুন মাটি পথ সেতু শহর গ্রাম বাগান বন দ্বীপ আকাশ বই টেবিল চেয়ার জানালা দরজা রান্নাঘর ফল রুটি পনির দুধ চা স্কুল বন্ধু পরিবার গান') },
    pt: { id: 'pt', name: 'Portuguese', native: 'Português', locale: 'pt', kind: 'alpha', alphabet: AZ, glyph: 1, len: [4, 9], title: 'Caça-palavras',
      words: w('casa cachorro gato árvore flor rio montanha praia estrela lua sol nuvem chuva vento fogo terra caminho ponte cidade vila jardim floresta ilha mar céu livro mesa cadeira janela porta cozinha fruta pão queijo leite café escola amigo família música') },
    ru: { id: 'ru', name: 'Russian', native: 'Русский', locale: 'ru', kind: 'alpha', alphabet: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', filler: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ', glyph: 0.95, len: [4, 9], title: 'Поиск слов',
      words: w('дом собака кошка дерево цветок река гора пляж звезда луна солнце облако дождь ветер огонь земля дорога мост город деревня сад лес остров море небо книга стол стул окно дверь кухня фрукт хлеб сыр молоко кофе школа друг семья музыка') },
    ur: { id: 'ur', name: 'Urdu', native: 'اردو', locale: 'ur', kind: 'arabic', rtl: true, alphabet: 'ابپتٹثجچحخدڈذرڑزژسشصضطظعغفقکگلمنںوہھیے' + 'آ', glyph: 0.85, len: [3, 7], title: 'لفظ تلاش',
      map: { 'ي': 'ی', 'ى': 'ی', 'ك': 'ک', 'ة': 'ہ', 'ۃ': 'ہ', 'ه': 'ہ', 'ۂ': 'ہ', 'ئ': 'ی', 'ؤ': 'و', 'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا' },
      words: w('گھر کتا بلی درخت پھول دریا پہاڑ ساحل ستارہ چاند سورج بادل بارش ہوا آگ زمین راستہ پل شہر گاؤں باغ جنگل جزیرہ سمندر آسمان کتاب میز کرسی کھڑکی دروازہ باورچی پھل روٹی پنیر دودھ چائے اسکول دوست خاندان موسیقی') },
    id: { id: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', locale: 'id', kind: 'alpha', alphabet: AZ, glyph: 1, len: [4, 9], title: 'Cari Kata',
      words: w('rumah anjing kucing pohon bunga sungai gunung pantai bintang bulan matahari awan hujan angin api tanah jalan jembatan kota desa taman hutan pulau laut langit buku meja kursi jendela pintu dapur buah roti keju susu kopi sekolah teman keluarga musik') },
    de: { id: 'de', name: 'German', native: 'Deutsch', locale: 'de', kind: 'alpha', alphabet: AZ + 'ÄÖÜ', glyph: 1, len: [4, 9], title: 'Wörtersuche',
      words: w('Haus Hund Katze Baum Blume Fluss Berg Strand Stern Mond Sonne Wolke Regen Wind Feuer Erde Weg Brücke Stadt Dorf Garten Wald Insel Meer Himmel Buch Tisch Stuhl Fenster Tür Küche Obst Brot Käse Milch Kaffee Schule Freund Familie Musik') }
  };
  const ORDER = ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur', 'id', 'de'];

  /* Text on the page itself. n is a count, t a total. */
  const T = (o) => o;
  const L10N = {
    en: T({ title: 'Word Search', find: (n) => 'Find ' + n + ' hidden word' + (n === 1 ? '' : 's'), findOne: 'Find the hidden word', solution: 'Solution',
      puzzleN: (n) => 'Puzzle ' + n, solutionN: (n) => 'Solution ' + n, solutions: 'Solutions',
      answers: (n) => (n === 1 ? 'The answer to the puzzle' : 'Answers to puzzles 1 to ' + n), pageN: (n) => 'Page ' + n, pageOf: (n, t) => 'Page ' + n + ' of ' + t }),
    zh: T({ find: (n) => '找出 ' + n + ' 个隐藏的词', findOne: '找出隐藏的词', solution: '答案', puzzleN: (n) => '谜题 ' + n, solutionN: (n) => '答案 ' + n, solutions: '答案',
      answers: (n) => (n === 1 ? '本谜题的答案' : '谜题 1 至 ' + n + ' 的答案'), pageN: (n) => '第 ' + n + ' 页', pageOf: (n, t) => '第 ' + n + ' 页，共 ' + t + ' 页' }),
    hi: T({ find: (n) => n + ' छिपे हुए शब्द खोजें', findOne: 'छिपा हुआ शब्द खोजें', solution: 'हल', puzzleN: (n) => 'पहेली ' + n, solutionN: (n) => 'हल ' + n, solutions: 'हल',
      answers: (n) => (n === 1 ? 'पहेली का हल' : 'पहेलियों 1 से ' + n + ' तक के हल'), pageN: (n) => 'पृष्ठ ' + n, pageOf: (n, t) => 'पृष्ठ ' + n + ' / ' + t }),
    es: T({ find: (n) => 'Encuentra ' + n + (n === 1 ? ' palabra oculta' : ' palabras ocultas'), findOne: 'Encuentra la palabra oculta', solution: 'Solución',
      puzzleN: (n) => 'Sopa de letras ' + n, solutionN: (n) => 'Solución ' + n, solutions: 'Soluciones',
      answers: (n) => (n === 1 ? 'La solución del puzle' : 'Soluciones de los puzles 1 a ' + n), pageN: (n) => 'Página ' + n, pageOf: (n, t) => 'Página ' + n + ' de ' + t }),
    fr: T({ find: (n) => 'Trouvez ' + n + (n === 1 ? ' mot caché' : ' mots cachés'), findOne: 'Trouvez le mot caché', solution: 'Solution',
      puzzleN: (n) => 'Grille ' + n, solutionN: (n) => 'Solution ' + n, solutions: 'Solutions',
      answers: (n) => (n === 1 ? 'La solution de la grille' : 'Solutions des grilles 1 à ' + n), pageN: (n) => 'Page ' + n, pageOf: (n, t) => 'Page ' + n + ' sur ' + t }),
    ar: T({ find: (n) => 'ابحث عن الكلمات المخفية: ' + n, findOne: 'ابحث عن الكلمة المخفية', solution: 'الحل', puzzleN: (n) => 'اللغز ' + n, solutionN: (n) => 'الحل ' + n, solutions: 'الحلول',
      answers: (n) => (n === 1 ? 'حل اللغز' : 'حلول الألغاز من 1 إلى ' + n), pageN: (n) => 'صفحة ' + n, pageOf: (n, t) => 'صفحة ' + n + ' من ' + t }),
    bn: T({ find: (n) => n + 'টি লুকানো শব্দ খুঁজুন', findOne: 'লুকানো শব্দটি খুঁজুন', solution: 'সমাধান', puzzleN: (n) => 'ধাঁধা ' + n, solutionN: (n) => 'সমাধান ' + n, solutions: 'সমাধান',
      answers: (n) => (n === 1 ? 'ধাঁধার সমাধান' : '1 থেকে ' + n + ' নম্বর ধাঁধার সমাধান'), pageN: (n) => 'পৃষ্ঠা ' + n, pageOf: (n, t) => 'পৃষ্ঠা ' + n + ' / ' + t }),
    pt: T({ find: (n) => 'Encontre ' + n + (n === 1 ? ' palavra escondida' : ' palavras escondidas'), findOne: 'Encontre a palavra escondida', solution: 'Solução',
      puzzleN: (n) => 'Caça-palavras ' + n, solutionN: (n) => 'Solução ' + n, solutions: 'Soluções',
      answers: (n) => (n === 1 ? 'A solução do desafio' : 'Soluções dos desafios 1 a ' + n), pageN: (n) => 'Página ' + n, pageOf: (n, t) => 'Página ' + n + ' de ' + t }),
    ru: T({ find: (n) => 'Найдите спрятанные слова: ' + n, findOne: 'Найдите спрятанное слово', solution: 'Решение', puzzleN: (n) => 'Головоломка ' + n, solutionN: (n) => 'Решение ' + n, solutions: 'Решения',
      answers: (n) => (n === 1 ? 'Решение головоломки' : 'Решения головоломок с 1 по ' + n), pageN: (n) => 'Страница ' + n, pageOf: (n, t) => 'Страница ' + n + ' из ' + t }),
    ur: T({ find: (n) => 'چھپے ہوئے ' + n + ' الفاظ تلاش کریں', findOne: 'چھپا ہوا لفظ تلاش کریں', solution: 'حل', puzzleN: (n) => 'پہیلی ' + n, solutionN: (n) => 'حل ' + n, solutions: 'حل',
      answers: (n) => (n === 1 ? 'پہیلی کا حل' : 'پہیلیوں 1 تا ' + n + ' کے حل'), pageN: (n) => 'صفحہ ' + n, pageOf: (n, t) => 'صفحہ ' + n + ' از ' + t }),
    id: T({ find: (n) => 'Temukan ' + n + ' kata tersembunyi', findOne: 'Temukan kata tersembunyi', solution: 'Jawaban', puzzleN: (n) => 'Teka-teki ' + n, solutionN: (n) => 'Jawaban ' + n, solutions: 'Jawaban',
      answers: (n) => (n === 1 ? 'Jawaban teka-teki' : 'Jawaban teka-teki 1 sampai ' + n), pageN: (n) => 'Halaman ' + n, pageOf: (n, t) => 'Halaman ' + n + ' dari ' + t }),
    de: T({ find: (n) => 'Finde ' + n + (n === 1 ? ' verstecktes Wort' : ' versteckte Wörter'), findOne: 'Finde das versteckte Wort', solution: 'Lösung',
      puzzleN: (n) => 'Rätsel ' + n, solutionN: (n) => 'Lösung ' + n, solutions: 'Lösungen',
      answers: (n) => (n === 1 ? 'Die Lösung des Rätsels' : 'Lösungen der Rätsel 1 bis ' + n), pageN: (n) => 'Seite ' + n, pageOf: (n, t) => 'Seite ' + n + ' von ' + t })
  };
  ORDER.forEach((id) => { if (!L10N[id].title) L10N[id].title = LANGS[id].title; });

  const api = { LANGS, ORDER, L10N };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WSL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
