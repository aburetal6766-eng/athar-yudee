'use strict';
// المحتوى الافتراضي للمنصة — كله قابل للتعديل من لوحة المعلمة.
const q = (id, text) => ({ id, text, required: true });

module.exports = function defaults() {
  return {
    branding: {
      platformName: 'أثرٌ يضيء',
      homeTagline: 'بحضوركِ يكتمل الأثر',
      homeIntro: 'منصة الدرس التطبيقي: اطّلعي على محتوى الدرس، وشاركينا تقييمكِ، واحصلي على شهادة حضوركِ باسمكِ.',
      rateTitle: 'رأيكِ يترك أثرًا',
      rateIntro: 'شكرًا لحضوركِ درسنا التطبيقي. يسعدنا تقييمكِ ومقترحاتكِ، وبعد الإرسال تظهر لكِ شهادة الحضور باسمكِ.',
      startButton: 'ابدئي التقييم',
      welcome: 'أهلًا بكِ في الدرس التطبيقي',
      thanks: 'شكرًا لكِ، أضأتِ أثرًا',
      closedMessage: 'انتهت فترة التقييم لهذا الدرس. شكرًا لاهتمامكِ، ويمكنكِ الاطلاع على محتوى الدرس.',
    },
    header: [
      'المملكة العربية السعودية',
      'وزارة التعليم',
      'الإدارة العامة للتعليم بمنطقة جازان',
      'الابتدائية والمتوسطة الأولى بأبوعريش وبرنامج ضعاف السمع',
    ],
    lesson: {
      kind: 'الدرس التطبيقي',
      title: 'Where Do You Live?',
      course: 'Super Goal 1 · Unit 7 · Listen and Discuss',
      subject: 'اللغة الإنجليزية',
      grade: 'الأول المتوسط',
      delivery: 'عن بُعد عبر Microsoft Teams',
      date: 'يوم الخميس ٢/٦/١٤٤٨هـ',
      teachersTitle: 'المعلمتان المنفذتان',
      teachers: 'أريج الأمير – وعد المرزوق',
      viceTitle: 'وكيلة الشؤون التعليمية',
      viceName: 'عائشة عطيفة سهلي',
      principalTitle: 'مديرة المدرسة',
      principalName: 'أمل هجري',
    },
    objectives: [
      { id: 'o1', text: 'Identify places in a neighborhood.' },
      { id: 'o2', text: 'Ask and answer questions about where they live.' },
      { id: 'o3', text: 'Give and follow simple directions.' },
    ],
    strategies: [],
    attachments: [],
    questions: [
      q('q1', 'وضوح أهداف الدرس'),
      q('q2', 'ملاءمة الاستراتيجيات وتنوعها'),
      q('q3', 'تفاعل الطالبات'),
      q('q4', 'مناسبة الأنشطة والوسائل'),
      q('q5', 'فاعلية التقويم'),
      q('q6', 'تنظيم الدرس وإدارة الوقت'),
    ],
    fields: {
      comment: { label: 'رأيكِ وتعليقكِ', required: true },
      suggestions: { label: 'مقترحاتكِ للتطوير', required: false },
    },
    cert: {
      title: 'شهادة حضور',
      body: [
        'تُمنح هذه الشهادة للأستاذة',
        '{الاسم}',
        'تقديرًا لحضورها ومشاركتها في الدرس التطبيقي في مادة {المادة}',
        '{عنوان_الدرس}',
        'للصف {الصف}، والمنفَّذ {طريقة_التنفيذ}',
        '{التاريخ}.',
      ].join('\n'),
      numberPrefix: 'ATH-1448-',
      showQr: true,
    },
    certLayout: {
      stamp: { x: 0.5, y: 0.865, w: 0.13 },
      sigVice: { x: 0.80, y: 0.915, w: 0.14 },
      sigPrincipal: { x: 0.20, y: 0.915, w: 0.14 },
    },
    categories: ['إشادة', 'مقترح تطوير', 'ملاحظة على الأنشطة', 'ملاحظة على التقويم', 'ملاحظة تقنية'],
  };
};
