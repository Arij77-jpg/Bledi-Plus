/**
 * Multi-Language Internationalization (i18n) Configuration (`src/i18n.ts`)
 *
 * Supports English (`en`), French (`fr`), and Arabic (`ar` with RTL awareness),
 * using `i18next`, `react-i18next`, and `expo-localization`, persisted across launches.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

export type SupportedLanguage = 'en' | 'fr' | 'ar';

export const LANGUAGE_STORAGE_KEY = '@bledi_plus/language';

export const SUPPORTED_LANGUAGES: Array<{
  code: SupportedLanguage;
  nativeLabel: string;
  englishLabel: string;
  isRTL: boolean;
}> = [
  { code: 'fr', nativeLabel: 'Français', englishLabel: 'French', isRTL: false },
  { code: 'en', nativeLabel: 'English', englishLabel: 'English', isRTL: false },
  { code: 'ar', nativeLabel: 'العربية', englishLabel: 'Arabic', isRTL: true },
];

export const resources = {
  en: {
    translation: {
      common: {
        appName: 'Bledi+ • بلادي+',
        slogan: 'A photo from you, and our country blooms together',
        sloganArabic: 'تصويرة منّك، وبلادنا تزيان بينا',
        sloganLatin: 'Taswira mennek, w bledna tizyen bina',
        reports: 'Reports',
        submit: 'Submit',
        camera: 'Camera',
        gallery: 'Photo Library',
        location: 'Location',
        settings: 'Settings',
        privacy: 'Privacy',
        status: 'Status',
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        close: 'Close',
        delete: 'Delete',
        back: 'Back',
        loading: 'Loading...',
        anonymousCitizen: 'Anonymous Citizen',
      },
      tabs: {
        feed: 'Reports',
        feedHeader: 'Bledi+ • Civic Feed',
        map: 'Live Map',
        mapHeader: 'Incident Map',
        report: 'Report',
        reportHeader: 'Report Issue',
        profile: 'Civic ID',
        profileHeader: 'Civic Profile',
        settings: 'Settings',
        settingsHeader: 'Settings & Preferences',
      },
      status: {
        pending: 'Pending',
        in_progress: 'In Progress',
        resolved: 'Resolved',
        completed: 'Completed',
      },
      categories: {
        all: 'All Issues',
        infrastructure: 'Infrastructure & Roads',
        infrastructureShort: 'Roads',
        sanitation: 'Sanitation & Waste',
        sanitationShort: 'Sanitation',
        lighting: 'Public Lighting',
        lightingShort: 'Lighting',
        water: 'Water & Sewage',
        waterShort: 'Water',
        other: 'Other Civic Issue',
        otherShort: 'Other',
      },
      actions: {
        meToo: 'Me too',
        confirmed: 'Confirmed',
        topPriority: 'Top Priority',
        mostRecent: 'Most Recent',
        submitReport: 'Submit Civic Report',
        capturePhoto: 'Capture or Upload Photo',
      },
      newReport: {
        title: 'New Civic Report',
        subtitle: 'Pinpoint local defects with clear visual evidence so dispatch teams can act faster.',
        incidentLocation: 'Incident Location',
        photoEvidence: 'Photo Evidence',
        required: 'Required',
        anonymousActive: 'Anonymous Mode Active — your name will be hidden publicly',
        approxLocationActive: 'Approximate GPS (~150m street privacy)',
        exactLocationActive: 'Exact GPS Locked',
      },
      settings: {
        subtitle: 'Customize appearance, language, privacy, and notifications',
        sections: {
          appearance: 'Appearance',
          language: 'Language & Region',
          privacy: 'Privacy & Security',
          notifications: 'Notifications & Alerts',
          account: 'Account & Data',
          about: 'About & Support',
        },
        theme: {
          title: 'App Theme',
          light: 'Light',
          dark: 'Dark',
          system: 'System',
          systemHint: 'Currently following OS ({{scheme}})',
        },
        language: {
          title: 'Interface Language',
          pickerTitle: 'Choose Language',
          rtlNote: 'Arabic uses Right-to-Left (RTL) layout formatting.',
          currentDesc: 'Applies immediately across menus and civic labels',
        },
        privacy: {
          anonymousTitle: 'Anonymous Reporting',
          anonymousDesc: 'Hide your full name and profile from other citizens on submitted reports',
          locationTitle: 'Approximate Location Precision',
          locationDesc: 'Round GPS coordinates (~150m grid) instead of sharing exact doorstep pins',
          privacyPolicy: 'Privacy Policy',
          termsOfService: 'Terms of Service',
        },
        notifications: {
          statusUpdatesTitle: 'Status Updates on My Reports',
          statusUpdatesDesc: 'Alert when municipal crews start work or upload resolution proof',
          nearbyTitle: 'Nearby Issues & Urgent Alerts',
          nearbyDesc: 'Notify about critical hazards reported in your neighborhood',
          upvotesTitle: 'Upvote Notifications',
          upvotesDesc: 'Alert when neighbors confirm ("Me too") your submitted reports',
        },
        account: {
          clearCacheTitle: 'Clear Local Cache & Drafts',
          clearCacheDesc: 'Removes temporary drafts and resets cached feed images without signing out',
          clearCacheSuccess: 'Cleared {{count}} cached draft item(s) and freed local storage.',
          downloadDataTitle: 'Download My Data',
          downloadDataDesc: 'Export your civic profile, preferences, and submission summary (JSON)',
          deleteAccountTitle: 'Delete My Account',
          deleteAccountDesc: 'Permanently erase your authentication profile and personal data',
          deleteConfirmTitle: 'Delete Account Permanently?',
          deleteConfirmBody:
            'This action is irreversible. Your Bledi+ account and stored preferences will be permanently removed.',
          deleteSuccess: 'Your account has been permanently deleted.',
          recentLoginRequired:
            'For security, please sign out and sign back in right before deleting your account.',
        },
        about: {
          versionTitle: 'Application Version',
          supportTitle: 'Bledi+ Civic Support',
          supportEmail: 'contact@blediplus.tn',
          licensesTitle: 'Open Source Licenses',
          licensesDesc: 'React Native, Expo, Firebase, i18next & Vector Icons',
        },
      },
      duplicateModal: {
        badge: 'Nearby Active Report',
        titleDistance: 'Found an existing report {{distance}} meters away',
        titleSameSpot: 'Found an existing report right at this spot',
        subtitle:
          'Confirming the existing report boosts municipal priority and avoids duplicate tickets.',
        distanceChip: '{{distance}}m away',
        upvotesCount: '{{count}} votes',
        moreMatches: 'Showing match {{current}} of {{total}} within {{radius}}m',
        upvoteAction: 'Upvote Existing',
        upvotedAction: 'Already Confirmed • Dismiss Form',
        reportAnywayAction: 'Report New Issue Anyway',
        upvotedAlertTitle: 'Issue Confirmed',
        upvotedAlertBody:
          'Your confirmation was added to the existing report to help prioritize crew dispatch.',
        scanningHint: 'Scanning nearby active issues...',
        bypassNotice: 'Duplicate alert acknowledged — ready to submit as a distinct report.',
      },
      comparison: {
        before: 'Before',
        after: 'After',
        dragHint: 'Drag divider left or right to compare',
        verifiedBanner: 'Verified Before / After Proof',
        compareAboveHint: 'Interactive Before / After split slider displayed at top',
      },
    },
  },
  fr: {
    translation: {
      common: {
        appName: 'Bledi+ • بلادي+',
        slogan: 'Une photo de vous, et notre pays s\'embellit grâce à nous',
        sloganArabic: 'تصويرة منّك، وبلادنا تزيان بينا',
        sloganLatin: 'Taswira mennek, w bledna tizyen bina',
        reports: 'Signalements',
        submit: 'Envoyer',
        camera: 'Caméra',
        gallery: 'Galerie photo',
        location: 'Localisation',
        settings: 'Paramètres',
        privacy: 'Confidentialité',
        status: 'Statut',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        save: 'Enregistrer',
        close: 'Fermer',
        delete: 'Supprimer',
        back: 'Retour',
        loading: 'Chargement...',
        anonymousCitizen: 'Citoyen Anonyme',
      },
      tabs: {
        feed: 'Signalements',
        feedHeader: 'Bledi+ • Fil Citoyen',
        map: 'Carte',
        mapHeader: 'Carte des Incidents',
        report: 'Signaler',
        reportHeader: 'Nouveau Signalement',
        profile: 'Identité',
        profileHeader: 'Profil Citoyen',
        settings: 'Paramètres',
        settingsHeader: 'Paramètres & Préférences',
      },
      status: {
        pending: 'En attente',
        in_progress: 'En cours',
        resolved: 'Résolu',
        completed: 'Complété',
      },
      categories: {
        all: 'Tous',
        infrastructure: 'Voirie & Infrastructure',
        infrastructureShort: 'Voirie',
        sanitation: 'Propreté & Déchets',
        sanitationShort: 'Propreté',
        lighting: 'Éclairage Public',
        lightingShort: 'Éclairage',
        water: 'Eau & Assainissement',
        waterShort: 'Eau',
        other: 'Autre Problème',
        otherShort: 'Autre',
      },
      actions: {
        meToo: 'Moi aussi',
        confirmed: 'Confirmé',
        topPriority: 'Plus urgents',
        mostRecent: 'Plus récents',
        submitReport: 'Publier le signalement',
        capturePhoto: 'Prendre ou choisir une photo',
      },
      newReport: {
        title: 'Nouveau Signalement',
        subtitle: 'Signalez un défaut urbain avec photo et GPS pour accélérer l’intervention.',
        incidentLocation: 'Localisation de l’incident',
        photoEvidence: 'Preuve Visuelle',
        required: 'Requis',
        anonymousActive: 'Mode Anonyme actif — votre nom sera masqué au public',
        approxLocationActive: 'GPS approximatif (~150 m de rayon)',
        exactLocationActive: 'GPS exact verrouillé',
      },
      settings: {
        subtitle: 'Personnalisez l’apparence, la langue, la confidentialité et les alertes',
        sections: {
          appearance: 'Apparence',
          language: 'Langue & Région',
          privacy: 'Confidentialité & Sécurité',
          notifications: 'Notifications & Alertes',
          account: 'Compte & Données',
          about: 'À propos & Crédits',
        },
        theme: {
          title: 'Thème de l’application',
          light: 'Clair',
          dark: 'Sombre',
          system: 'Système',
          systemHint: 'Synchronisé avec le système ({{scheme}})',
        },
        language: {
          title: 'Langue de l’interface',
          pickerTitle: 'Choisir la langue',
          rtlNote: 'L’arabe active la mise en page de droite à gauche (RTL).',
          currentDesc: 'Appliquée instantanément sans redémarrage',
        },
        privacy: {
          anonymousTitle: 'Signalement Anonyme',
          anonymousDesc: 'Masquer votre nom complet auprès des autres citoyens sur vos signalements',
          locationTitle: 'Localisation Approximative',
          locationDesc: 'Arrondir les coordonnées GPS (~150 m) au lieu d’afficher l’adresse exacte',
          privacyPolicy: 'Politique de Confidentialité',
          termsOfService: 'Conditions d’Utilisation',
        },
        notifications: {
          statusUpdatesTitle: 'Mises à jour de mes signalements',
          statusUpdatesDesc: 'Alerte dès qu’une équipe intervient ou publie la preuve après travaux',
          nearbyTitle: 'Incidents à proximité & Urgences',
          nearbyDesc: 'Recevoir les alertes critiques signalées dans votre quartier',
          upvotesTitle: 'Notifications de soutien',
          upvotesDesc: 'Alerte lorsqu’un voisin confirme (« Moi aussi ») votre signalement',
        },
        account: {
          clearCacheTitle: 'Vider le cache local & brouillons',
          clearCacheDesc: 'Supprime les brouillons temporaires sans vous déconnecter',
          clearCacheSuccess: '{{count}} élément(s) temporaire(s) nettoyé(s) du cache local.',
          downloadDataTitle: 'Télécharger mes données',
          downloadDataDesc: 'Exporter votre profil, préférences et historique au format JSON',
          deleteAccountTitle: 'Supprimer mon compte',
          deleteAccountDesc: 'Effacer définitivement votre compte Firebase Auth et vos données locales',
          deleteConfirmTitle: 'Supprimer définitivement le compte ?',
          deleteConfirmBody:
            'Cette action est irréversible. Votre compte Bledi+ et vos préférences locales seront définitivement supprimés.',
          deleteSuccess: 'Votre compte a été supprimé définitivement.',
          recentLoginRequired:
            'Par mesure de sécurité, veuillez vous reconnecter juste avant de supprimer votre compte.',
        },
        about: {
          versionTitle: 'Version de l’application',
          supportTitle: 'Support Citoyen Bledi+',
          supportEmail: 'contact@blediplus.tn',
          licensesTitle: 'Licences Open Source',
          licensesDesc: 'React Native, Expo, Firebase, i18next & Vector Icons',
        },
      },
      duplicateModal: {
        badge: 'Signalement actif à proximité',
        titleDistance: 'Signalement existant trouvé à {{distance}} mètres',
        titleSameSpot: 'Signalement existant trouvé exactement ici',
        subtitle:
          'Soutenir le signalement existant renforce sa priorité municipale et évite les doublons.',
        distanceChip: 'À {{distance}} m',
        upvotesCount: '{{count}} soutiens',
        moreMatches: 'Correspondance {{current}} sur {{total}} dans un rayon de {{radius}} m',
        upvoteAction: 'Soutenir l’existant',
        upvotedAction: 'Déjà soutenu • Fermer',
        reportAnywayAction: 'Signaler un nouveau problème quand même',
        upvotedAlertTitle: 'Soutien enregistré',
        upvotedAlertBody:
          'Votre confirmation a été ajoutée au signalement existant pour prioriser l’intervention.',
        scanningHint: 'Recherche de signalements similaires à proximité...',
        bypassNotice: 'Doublon ignoré — prêt pour publier un nouveau signalement distinct.',
      },
      comparison: {
        before: 'Avant',
        after: 'Après',
        dragHint: 'Glissez le curseur à gauche ou à droite pour comparer',
        verifiedBanner: 'Preuve Avant / Après vérifiée',
        compareAboveHint: 'Comparateur interactif Avant / Après affiché en haut de la fiche',
      },
    },
  },
  ar: {
    translation: {
      common: {
        appName: 'بلادي+ • Bledi+',
        slogan: 'تصويرة منّك، وبلادنا تزيان بينا',
        sloganArabic: 'تصويرة منّك، وبلادنا تزيان بينا',
        sloganLatin: 'Taswira mennek, w bledna tizyen bina',
        reports: 'البلاغات',
        submit: 'إرسال',
        camera: 'الكاميرا',
        gallery: 'معرض الصور',
        location: 'الموقع',
        settings: 'الإعدادات',
        privacy: 'الخصوصية',
        status: 'الحالة',
        cancel: 'إلغاء',
        confirm: 'تأكيد',
        save: 'حفظ',
        close: 'إغلاق',
        delete: 'حذف',
        back: 'رجوع',
        loading: 'جارٍ التحميل...',
        anonymousCitizen: 'مواطن مجهول الهوية',
      },
      tabs: {
        feed: 'البلاغات',
        feedHeader: 'بلادي+ • تصويرة منّك، وبلادنا تزيان بينا',
        map: 'الخريطة',
        mapHeader: 'خريطة الأعطال',
        report: 'بلاغ جديد',
        reportHeader: 'الإبلاغ عن مشكلة',
        profile: 'حسابي',
        profileHeader: 'الملف المدني',
        settings: 'الإعدادات',
        settingsHeader: 'الإعدادات والتفضيلات',
      },
      status: {
        pending: 'قيد الانتظار',
        in_progress: 'قيد المعالجة',
        resolved: 'تم الحل',
        completed: 'مُنجز',
      },
      categories: {
        all: 'كل البلاغات',
        infrastructure: 'البنية التحتية والطرقات',
        infrastructureShort: 'الطرقات',
        sanitation: 'النظافة والنفايات',
        sanitationShort: 'النظافة',
        lighting: 'الإنارة العمومية',
        lightingShort: 'الإنارة',
        water: 'المياه والصرف الصحي',
        waterShort: 'المياه',
        other: 'مشكلة أخرى',
        otherShort: 'أخرى',
      },
      actions: {
        meToo: 'أؤكد المشكلة',
        confirmed: 'تم التأكيد',
        topPriority: 'الأكثر أولوية',
        mostRecent: 'الأحدث',
        submitReport: 'إرسال البلاغ المدني',
        capturePhoto: 'التقاط أو اختيار صورة',
      },
      newReport: {
        title: 'بلاغ مدني جديد',
        subtitle: 'حدّد المشكلة بصورة واضحة وموقع GPS لتسريع تدخل البلدية.',
        incidentLocation: 'موقع المشكلة',
        photoEvidence: 'الصورة الداعمة',
        required: 'إلزامي',
        anonymousActive: 'الوضع المجهول مفعل — سيتم إخفاء اسمك عن العموم',
        approxLocationActive: 'موقع تقريبي (نطاق ~150 متر للخصوصية)',
        exactLocationActive: 'تم تحديد الموقع الدقيق',
      },
      settings: {
        subtitle: 'تخصيص المظهر، اللغة، الخصوصية، وإشعارات البلدية',
        sections: {
          appearance: 'المظهر',
          language: 'اللغة والمنطقة',
          privacy: 'الخصوصية والأمان',
          notifications: 'الإشعارات والتنبيهات',
          account: 'الحساب والبيانات',
          about: 'حول التطبيق',
        },
        theme: {
          title: 'مظهر التطبيق',
          light: 'فاتح',
          dark: 'داكن',
          system: 'النظام',
          systemHint: 'يتبع مظهر الجهاز الحالي ({{scheme}})',
        },
        language: {
          title: 'لغة الواجهة',
          pickerTitle: 'اختر اللغة',
          rtlNote: 'تُفعّل اللغة العربية تنسيق القراءة من اليمين إلى اليسار (RTL).',
          currentDesc: 'يتم التبديل فورياً عبر قوائم التطبيق',
        },
        privacy: {
          anonymousTitle: 'الإبلاغ بهوية مجهولة',
          anonymousDesc: 'إخفاء اسمك الكامل وملفك الشخصي عن بقية المواطنين في البلاغات',
          locationTitle: 'تقريب دقة الموقع الجغرافي',
          locationDesc: 'تقريب إحداثيات GPS (~150 متر) لحماية خصوصية منزلك في البلاغات الحساسة',
          privacyPolicy: 'سياسة الخصوصية',
          termsOfService: 'شروط الاستخدام',
        },
        notifications: {
          statusUpdatesTitle: 'تحديثات حالة بلاغاتي',
          statusUpdatesDesc: 'تنبيه عند مباشرة الفرق البلدية أو رفع صورة إثبات الإصلاح',
          nearbyTitle: 'الأعطال القريبة والتنبيهات العاجلة',
          nearbyDesc: 'إشعار بالمشاكل الخطيرة المُبلّغ عنها في حيك',
          upvotesTitle: 'إشعارات التأييد',
          upvotesDesc: 'تنبيه عندما يؤكد الجيران صحة بلاغك',
        },
        account: {
          clearCacheTitle: 'مسح الذاكرة المؤقتة والمسودات',
          clearCacheDesc: 'حذف المسودات المؤقتة دون تسجيل الخروج',
          clearCacheSuccess: 'تم مسح {{count}} عنصر(عناصر) مؤقتة بنجاح.',
          downloadDataTitle: 'تنزيل بياناتي',
          downloadDataDesc: 'تصدير بيانات ملفك وتفضيلاتك بصيغة JSON',
          deleteAccountTitle: 'حذف حسابي نهائياً',
          deleteAccountDesc: 'إزالة حساب المصادقة وبياناتك الشخصية بشكل دائم',
          deleteConfirmTitle: 'تأكيد حذف الحساب نهائياً؟',
          deleteConfirmBody:
            'لا يمكن التراجع عن هذا الإجراء. سيتم حذف حسابك في تطبيق بلادي+ وتفضيلاتك بشكل دائم.',
          deleteSuccess: 'تم حذف حسابك نهائياً.',
          recentLoginRequired:
            'لأسباب أمنية، يرجى تسجيل الخروج ثم إعادة تسجيل الدخول قبل حذف الحساب.',
        },
        about: {
          versionTitle: 'إصدار التطبيق',
          supportTitle: 'دعم منصة بلادي+',
          supportEmail: 'contact@blediplus.tn',
          licensesTitle: 'التراخيص مفتوحة المصدر',
          licensesDesc: 'React Native, Expo, Firebase, i18next & Vector Icons',
        },
      },
      duplicateModal: {
        badge: 'بلاغ نشط قريب منك',
        titleDistance: 'تم العثور على بلاغ مماثل على بُعد {{distance}} متراً',
        titleSameSpot: 'تم العثور على بلاغ مماثل في هذا الموقع',
        subtitle:
          'تأييد البلاغ القائم يرفع أولويته لدى الفرق البلدية ويمنع تكرار التذاكر.',
        distanceChip: 'على بُعد {{distance}} م',
        upvotesCount: '{{count}} تأييد',
        moreMatches: 'عرض {{current}} من {{total}} ضمن نطاق {{radius}} متر',
        upvoteAction: 'تأييد البلاغ الحالي',
        upvotedAction: 'مؤيد مسبقاً • إغلاق',
        reportAnywayAction: 'إرسال بلاغ جديد على أي حال',
        upvotedAlertTitle: 'تم تسجيل التأييد',
        upvotedAlertBody: 'تمت إضافة تأييدك إلى البلاغ القائم لتسريع تدخل الفرق البلدية.',
        scanningHint: 'جارٍ فحص البلاغات النشطة القريبة...',
        bypassNotice: 'تم تجاوز تنبيه التكرار — جاهز لإرسال بلاغ جديد مستقل.',
      },
      comparison: {
        before: 'قبل',
        after: 'بعد',
        dragHint: 'اسحب الفاصل يميناً أو يساراً للمقارنة',
        verifiedBanner: 'توثيق موثق قبل وبعد الإصلاح',
        compareAboveHint: 'أداة المقارنة التفاعلية قبل وبعد معروضة أعلى الصفحة',
      },
    },
  },
} as const;

function detectDeviceLanguage(): SupportedLanguage {
  try {
    const locales = Localization.getLocales();
    const code = locales?.[0]?.languageCode?.toLowerCase();
    if (code === 'fr' || code === 'ar' || code === 'en') {
      return code;
    }
  } catch {
    // Graceful web/test fallback
  }
  return 'en';
}

export function isLanguageRTL(lang: string): boolean {
  return lang.startsWith('ar');
}

export async function initializeI18n(): Promise<SupportedLanguage> {
  let targetLang: SupportedLanguage = detectDeviceLanguage();

  try {
    const persisted = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (persisted === 'en' || persisted === 'fr' || persisted === 'ar') {
      targetLang = persisted;
    }
  } catch {
    // Use device default
  }

  try {
    I18nManager.allowRTL(true);
    const shouldBeRTL = isLanguageRTL(targetLang);
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
    }
  } catch {
    // Web ignores I18nManager safely
  }

  if (i18n.isInitialized && i18n.language !== targetLang) {
    await i18n.changeLanguage(targetLang);
  }

  return targetLang;
}

export async function setAppLanguage(lang: SupportedLanguage): Promise<{ rtlChanged: boolean }> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);

  const shouldBeRTL = isLanguageRTL(lang);
  let rtlChanged = false;
  try {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      rtlChanged = true;
    }
  } catch {
    // Web/non-native fallback
  }

  return { rtlChanged };
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
