'use strict';
// Draft programme, transcribed from the conference schedule (RCSSST template, 3 days, 4 parallel rooms).
// The days follow the event dates in Admin → Settings (day 1, 2, 3). Edit this file to change the programme.
// Each talk: [start, end, code, track, name]. Codes starting with "INV" are invited talks.

const ROOMS = ['Ballroom', 'Hibiscus 1', 'Hibiscus 2', 'Hibiscus 5'];
const AM = [['0835', '0900'], ['0900', '0925'], ['0925', '0945'], ['0945', '1005'], ['1005', '1025']];
const t = (slot, code, track, name) => [slot[0], slot[1], code, track, name];
const am = (rows) => rows.map((r, i) => t(AM[i], ...r));

const ADV = 'Advanced Materials', NANO = 'Nanoscience & Nanotechnology', MAG = 'Magnetism & Superconductivity', DEV = 'Devices & Instrumentation',
  OPT = 'Optics & Photonics', POL = 'Polymers', MET = 'Metals & Alloys', NUC = 'Nuclear-Related Materials', QT = 'Quantum Technology', COMP = 'Computational Materials Science';

const DAYS = [
  { // Day 1
    blocks: [
      { time: ['1425', '1720'], kind: 'reg', title: 'Registration', where: 'Ballroom entrance' },
      { time: ['1515', '1615'], kind: 'tech', title: 'Technical session: Scanning Electron Microscope', who: 'Muhammad Azmi Abdul Hamid (UKM)', where: 'Hibiscus 5' },
      { time: ['1615', '1720'], kind: 'tech', title: 'Technical session: X-ray Fluorescence', who: 'Jitendra Kumar (Malvern Panalytical)', where: 'Hibiscus 5' },
      { time: ['1720', '1740'], kind: 'break', title: 'Coffee break' },
      { time: ['1740', ''], kind: 'end', title: 'End of day 1' },
    ],
  },
  { // Day 2
    blocks: [
      { time: ['0815', '0835'], kind: 'all', title: 'Welcoming remarks', where: 'Ballroom' },
      { time: ['0835', '1025'], kind: 'parallel', title: 'Parallel sessions 1–4', rooms: [
        am([['INV 1-1', ADV, 'Abdul Halim Shaari'], ['INV 1-2', ADV, 'Ahmad Mukifza Harun'], ['Oral 1-3', ADV, 'Shahrzad Shaddel'], ['Oral 1-4', ADV, 'Efil Yusrianto'], ['Oral 1-5', ADV, 'Nur Arifazleen Aris']]),
        am([['INV 2-1', ADV, 'Mohd Hafiz bin Mohd Zaid'], ['INV 2-2', ADV, 'Khamirul Amin Matori'], ['Oral 2-3', ADV, 'Siti Aisyah binti Shamsudin'], ['Oral 2-4', ADV, 'Siti Nur Fatihah binti Kamaruzaman'], ['Oral 2-5', ADV, 'Nurul Hanis binti Azhan']]),
        am([['INV 3-1', NANO, 'Zainal Abidin Talib'], ['INV 3-2', NANO, 'Fatin Saiha Omar'], ['Oral 3-3', NANO, 'Mega Fatmasari'], ['Oral 3-4', NANO, 'Nabeel Jamal Kadhim Alshakkakee'], ['Oral 3-5', NANO, 'Siti Nur Hidayah binti Yahya']]),
        am([['INV 4-1', MAG, 'Lau Lik Nguong'], ['INV 4-2', MAG, 'Noor Baa’yah Ibrahim'], ['Oral 4-3', MAG, 'Najihah binti Rohiat'], ['Oral 4-4', MAG, 'Nur Humaira Yasmin binti Mohd Alimi'], ['Oral 4-5', MAG, 'Norazila binti Ibrahim']]),
      ] },
      { time: ['1030', '1100'], kind: 'break', title: 'Coffee break' },
      { time: ['1100', '1200'], kind: 'plenary', title: 'Plenary lecture', who: 'Ms. Dileezaa Lurthanathan (PETRONAS)', where: 'Ballroom' },
      { time: ['1200', '1305'], kind: 'parallel', title: 'Midday sessions', rooms: [
        [],
        [['1200', '1305', '', 'Technical session', 'X-ray Diffractometer — Manoel Manuputty (Bruker AXS)']],
        [['1200', '1305', '', 'Dialogue', 'Dialogue with the National Advanced Materials Consortium']],
        [['1200', '1225', 'INV 4-6', MAG, 'Aima binti Ramli'], ['1225', '1245', 'Oral 4-7', MAG, 'Nur Athirah binti Che Dzulkifli'], ['1245', '1305', 'Oral 4-8', ADV, 'Muhamad Afiq Haiqal bin Azlan']],
      ] },
      { time: ['1305', '1425'], kind: 'break', title: 'Lunch break' },
      { time: ['1425', '1555'], kind: 'parallel', title: 'Parallel sessions 1–4 (continued)', rooms: [
        [['1425', '1450', 'INV 1-6', ADV, 'Chen Ruey Shan'], ['1450', '1515', 'Oral 1-7', ADV, 'Yap Chi Chin'], ['1515', '1535', 'Oral 1-8', ADV, 'Wejdan Madi Sweilem Alharafsheh']],
        [['1425', '1450', 'INV 2-6', ADV, 'Zulkarnain Zainal'], ['1450', '1515', 'INV 2-7', ADV, 'Noratiqah binti Yusop'], ['1515', '1535', 'Oral 2-8', DEV, 'Mohd Amir Radhi Othman'], ['1535', '1555', 'Oral 2-9', ADV, 'Nurul Fatin Zulaikha binti Fazli']],
        [['1425', '1450', 'INV 3-6', NANO, 'Nurul Asikin Mijan'], ['1450', '1515', 'INV 3-7', NANO, 'Chiu Wee Siong'], ['1515', '1535', 'Oral 3-8', NANO, 'Amin bin Mohd Ikhsan'], ['1535', '1555', 'Oral 3-9', OPT, 'Wan Maisarah binti Mukhtar']],
        [['1425', '1450', 'INV 4-9', MAG, 'Akmal Zaini Arsad'], ['1450', '1515', 'INV 4-10', MAG, 'Hussein Abdullah Hussein Baqiah'], ['1515', '1535', 'Oral 4-11', ADV, 'Mohammad Ghaddaffi Mohd Noh'], ['1535', '1555', 'Oral 4-12', ADV, 'Zeng Yu']],
      ] },
      { time: ['1555', '1615'], kind: 'break', title: 'Coffee break' },
      { time: ['1615', '1740'], kind: 'parallel', title: 'Late-afternoon sessions', rooms: [
        [['1615', '1740', '', 'Exhibition', 'Product demonstration (exhibition area)']],
        [['1615', '1640', 'INV 2-10', MAG, 'Mohd Mustafa Awang Kechik'], ['1640', '1700', 'Oral 2-11', ADV, 'Husniyah Aliyah binti Lutpi'], ['1700', '1720', 'Oral 2-12', ADV, 'Dominic Geruka']],
        [['1615', '1640', 'INV 3-10', NANO, 'Mohamad Rusop'], ['1640', '1700', 'INV 3-11', NANO, 'Mohd Hafizuddin Ab Ghani'], ['1700', '1720', 'Oral 3-12', NANO, 'Mohd Sabri bin Mohd Ghazali'], ['1720', '1740', 'Oral 3-13', NANO, 'Juan Matmin']],
        [['1615', '1640', 'INV 4-13', MAG, 'Chen Soo Kien'], ['1640', '1700', 'Oral 4-14', ADV, 'Tan Sin Tee'], ['1700', '1720', 'Oral 4-15', ADV, 'Nurulhuda binti Mohammad Yusoff'], ['1720', '1740', 'Oral 4-16', ADV, 'Muhammad Feidhul Hakim bin Fatah Yasin']],
      ] },
      { time: ['1740', '1930'], kind: 'break', title: 'Rest' },
      { time: ['1930', '2200'], kind: 'gala', title: 'Opening ceremony & conference dinner', where: 'Ballroom' },
    ],
  },
  { // Day 3
    blocks: [
      { time: ['0835', '1025'], kind: 'parallel', title: 'Parallel sessions 5–8', rooms: [
        am([['INV 5-1', ADV, 'Lau Kok Tee'], ['INV 5-2', ADV, 'Muhamad Kamil bin Yaakob'], ['Oral 5-3', MAG, 'Rozilah Rajmi'], ['Oral 5-4', COMP, 'Amir Adli bin Sham Sani'], ['Oral 5-5', DEV, 'Mohamad bin Deraman']]),
        am([['INV 6-1', POL, 'Yusri Helmi bin Muhammad'], ['INV 6-2', POL, 'Lee Tian Khoon'], ['Oral 6-3', POL, 'Nur Nabilah binti Shahril'], ['Oral 6-4', POL, 'Siti Musleha binti Yunus'], ['Oral 6-5', DEV, 'Jazurainifariza binti Jaafar']]),
        am([['INV 7-1', MET, 'Huda Abdullah'], ['INV 7-2', MET, 'Wan Yusmawati binti Wan Yusoff'], ['Oral 7-3', MET, 'Nur Aishah binti Zafre'], ['Oral 7-4', MET, 'Azran Mohd Zainoodin'], ['Oral 7-5', MET, 'Azman bin Jalar']]),
        am([['INV 8-1', NUC, 'Iskandar Shahrim bin Mustafa'], ['Oral 8-2', NUC, 'Siti Sarah binti Mohamad Pauzi'], ['Oral 8-3', NUC, 'Wan Nordiana binti W Abd Rahman'], ['Oral 8-4', OPT, 'Emy Syameyra binti Abdul Razak'], ['Oral 8-5', OPT, 'Mohd Narizee Mohd Nasir']]),
      ] },
      { time: ['1030', '1100'], kind: 'break', title: 'Coffee break' },
      { time: ['1100', '1200'], kind: 'plenary', title: 'Keynote lecture', who: 'Prof. Dr. Chorng Haur Sow (National University of Singapore)', where: 'Ballroom' },
      { time: ['1200', '1305'], kind: 'parallel', title: 'Midday sessions', rooms: [
        [['1200', '1305', '', 'Posters', 'Poster session']],
        [['1200', '1305', '', 'Technical session', 'Thermal Analyzer — Zainal Abidin Talib (RGS Corporation)']],
        [], [],
      ] },
      { time: ['1305', '1425'], kind: 'break', title: 'Lunch break' },
      { time: ['1425', '1555'], kind: 'parallel', title: 'Parallel sessions 5–8 (continued)', rooms: [
        [['1425', '1450', 'INV 5-6', ADV, 'Noor Fazliani binti Shoparwe'], ['1450', '1515', 'Oral 5-7', ADV, 'Ismarul Nizam Ismail'], ['1515', '1535', 'Oral 5-8', ADV, 'Nor Huwaida binti Janil @ Jamil'], ['1535', '1555', 'Oral 5-9', MET, 'Nurhana Kamila binti Ahmad Sham']],
        [['1425', '1450', 'INV 6-6', POL, 'Hatika binti Kaco'], ['1450', '1515', 'INV 6-7', POL, 'Farhana Othman'], ['1515', '1535', 'Oral 6-8', OPT, 'Nurul Auni Afifah binti Ahmad Zahidi'], ['1535', '1555', 'Oral 6-9', OPT, 'Marsya Nadhirah binti Mazlan']],
        [['1425', '1450', 'INV 7-6', MET, 'Muhammad Hussain Ismail'], ['1450', '1515', 'INV 7-7', QT, 'Nor Azwa Zakaria'], ['1515', '1535', 'Oral 7-8', QT, 'Roslan Abd Shukor'], ['1535', '1555', 'Oral 7-9', ADV, 'Yazid Yaakob']],
        [['1425', '1450', 'INV 8-6', MAG, 'Lim Kean Pah'], ['1450', '1515', 'Oral 8-7', ADV, 'Loh Kee Shyuan'], ['1515', '1535', 'Oral 8-8', ADV, 'Isabelle Regina Chan Jia Yan'], ['1535', '1555', 'Oral 8-9', ADV, 'Timothy Teo Mun Hao']],
      ] },
      { time: ['1555', '1640'], kind: 'break', title: 'Coffee break' },
      { time: ['1640', '1740'], kind: 'gala', title: 'Closing ceremony', where: 'Ballroom' },
    ],
  },
];

module.exports = { ROOMS, DAYS };
