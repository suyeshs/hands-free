import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Monitor, Smartphone, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../src/contexts/LocaleContext';
import { DownloadCard, DownloadOption } from '../components/DownloadCard';
import { detectOS, getOSInfo, isAppleSilicon } from '../src/utils/osDetection';
import type { OSType } from '../src/utils/osDetection';

// OS Icons Components
const WindowsIcon = () => (
  <svg viewBox="0 0 88 88" fill="currentColor" className="w-full h-full">
    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349l-.011 41.34-47.318-6.678-.066-34.739z"/>
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

const LinuxIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.84-.41 1.705-.401 2.426.027 2.214 1.619 2.939 2.232 2.939.218 0 .37-.037.486-.082.27-.103.582-.55.597-.738.03-.36.488-2.423 1.318-3.99.14-.265.274-.52.395-.764.183 1.916 1.108 3.696 2.314 4.812.656.607 1.425 1.077 2.296 1.077.87 0 1.64-.47 2.296-1.077 1.206-1.116 2.13-2.896 2.313-4.812.121.244.255.499.395.764.83 1.567 1.289 3.63 1.318 3.99.015.188.327.635.597.738.116.045.268.082.486.082.613 0 2.205-.725 2.232-2.939.009-.721-.123-1.586-.401-2.426-.589-1.771-1.831-3.47-2.715-4.521-.75-1.067-.975-1.928-1.05-3.02-.066-1.491 1.055-5.965-3.17-6.298-.166-.013-.326-.021-.481-.021zm-.134 2.552c.273 0 .533.033.781.097-.012.288-.033.574-.065.858-.078.694-.218 1.37-.424 2.03-.15-.494-.24-1.008-.24-1.54 0-.94.374-1.445.948-1.445zm1.168.098c.574 0 .948.505.948 1.445 0 .532-.09 1.046-.24 1.54-.206-.66-.346-1.336-.424-2.03-.032-.284-.053-.57-.065-.858.248-.064.508-.097.781-.097zm-2.6.989c-.002.11-.005.22-.005.33 0 .653.098 1.283.276 1.883-.24.216-.497.41-.772.577-.408.248-.857.434-1.337.543-.218-.616-.347-1.267-.37-1.948-.025-.743.117-1.458.462-2.091.354.295.748.545 1.177.735.12.052.24.101.362.146-.003.274-.006.545 0 .825zm5.2 0c.006-.28.003-.551 0-.825.122-.045.243-.094.362-.146.429-.19.823-.44 1.177-.735.345.633.487 1.348.462 2.091-.023.681-.152 1.332-.37 1.948-.48-.109-.929-.295-1.337-.543-.275-.167-.532-.361-.772-.577.178-.6.276-1.23.276-1.883 0-.11-.003-.22-.005-.33zm-4.715 3.17c.41-.013.816.07 1.197.238.397.178.76.445 1.06.793.27-.31.582-.572.92-.77.404-.237.85-.362 1.302-.362.114 0 .227.01.34.027.223.036.44.1.65.19-.108.214-.218.426-.334.636-.347.636-.748 1.25-1.207 1.844-.108.14-.22.278-.335.415-.294-.28-.612-.518-.95-.707-.342-.19-.712-.317-1.097-.37-.108-.015-.216-.022-.325-.022-.435 0-.87.087-1.278.254-.396.163-.76.393-1.081.675-.126-.148-.246-.295-.361-.447-.448-.594-.844-1.208-1.191-1.844-.116-.21-.226-.422-.334-.636.21-.09.427-.154.65-.19.113-.017.226-.027.34-.027.067 0 .134.003.201.007z"/>
  </svg>
);

const AndroidIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M17.523 15.341c-.759 0-1.379-.62-1.379-1.379s.62-1.379 1.379-1.379 1.379.62 1.379 1.379-.62 1.379-1.379 1.379zm-11.046 0c-.759 0-1.379-.62-1.379-1.379s.62-1.379 1.379-1.379 1.379.62 1.379 1.379-.62 1.379-1.379 1.379zm11.046-7.838c.759 0 1.379.62 1.379 1.379v5.517c0 .759-.62 1.379-1.379 1.379h-11.046c-.759 0-1.379-.62-1.379-1.379V8.882c0-.759.62-1.379 1.379-1.379h11.046M21 9.862c-.69 0-1.241.552-1.241 1.241v4.137c0 .69.552 1.241 1.241 1.241s1.241-.552 1.241-1.241v-4.137c0-.69-.552-1.241-1.241-1.241M3 9.862c-.69 0-1.241.552-1.241 1.241v4.137c0 .69.552 1.241 1.241 1.241s1.241-.552 1.241-1.241v-4.137c0-.69-.552-1.241-1.241-1.241m13.523-3.448H7.477l1.379-2.759c.069-.138.069-.276 0-.414L7.477.483c-.138-.207-.414-.276-.621-.138s-.276.414-.138.621l1.172 2.345H7.477c-1.379 0-2.483 1.103-2.483 2.483v.69c0 1.379 1.103 2.483 2.483 2.483h9.046c1.379 0 2.483-1.103 2.483-2.483v-.69c0-1.379-1.103-2.483-2.483-2.483z"/>
  </svg>
);

export function DownloadsPage() {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [detectedOS, setDetectedOS] = useState<OSType>('unknown');
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    // Check for access token
    const accessToken = sessionStorage.getItem('download_access');
    const name = sessionStorage.getItem('download_name');

    if (!accessToken) {
      // Redirect to gate page if no access
      navigate(`/${locale}/download`);
      return;
    }

    if (name) {
      setUserName(name);
    }

    // Detect OS
    const osInfo = getOSInfo();
    setDetectedOS(osInfo.type);
  }, [locale, navigate]);

  const downloadOptions: DownloadOption[] = [
    {
      os: 'windows',
      name: 'Windows',
      icon: <WindowsIcon />,
      version: '1.0.2',
      fileSize: '245 MB',
      requirements: String(t('downloads.cards.windows.requirements')),
      downloadUrl: 'https://github.com/suyeshs/hands-free/releases/latest/download/HandsFree-Windows-Setup.exe',
    },
    {
      os: 'macos',
      name: isAppleSilicon() ? 'macOS (Apple Silicon)' : 'macOS (Intel)',
      icon: <AppleIcon />,
      version: '1.0.2',
      fileSize: isAppleSilicon() ? '198 MB' : '215 MB',
      requirements: String(t('downloads.cards.macos.requirements')),
      downloadUrl: isAppleSilicon()
        ? 'https://github.com/suyeshs/hands-free/releases/latest/download/HandsFree-macOS-arm64.dmg'
        : 'https://github.com/suyeshs/hands-free/releases/latest/download/HandsFree-macOS-x64.dmg',
    },
    {
      os: 'linux',
      name: 'Linux',
      icon: <LinuxIcon />,
      version: '1.0.2',
      fileSize: '187 MB',
      requirements: String(t('downloads.cards.linux.requirements')),
      downloadUrl: 'https://github.com/suyeshs/hands-free/releases/latest/download/HandsFree-Linux-amd64.deb',
    },
    {
      os: 'android',
      name: 'Android',
      icon: <AndroidIcon />,
      version: '1.0.1',
      fileSize: '156 MB',
      requirements: String(t('downloads.cards.android.requirements')),
      downloadUrl: 'https://github.com/suyeshs/hands-free/releases/latest/download/HandsFree-Android.apk',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-paprika/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-saffron/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-honey/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-20">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(`/${locale}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-warm-white transition-colors mb-8"
        >
          <ArrowLeft size={20} />
          <span>{String(t('downloads.backToHome'))}</span>
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          {userName && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 mb-4"
            >
              {String(t('downloads.welcomeBack', { name: '' }))}{' '}
              <span className="text-saffron font-medium">{userName}</span>
            </motion.p>
          )}

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 bg-gradient-warm rounded-3xl shadow-warm-glow mb-6"
          >
            <Download className="w-12 h-12 text-white" />
          </motion.div>

          <h1 className="text-5xl md:text-6xl font-display font-semibold text-warm-white mb-4">
            {t('downloads.headline')}
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t('downloads.subheadline')}
          </p>
        </motion.div>

        {/* Download Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {downloadOptions.map((option, index) => (
            <motion.div
              key={option.os}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.5 }}
            >
              <DownloadCard
                option={option}
                isRecommended={option.os === detectedOS}
                t={t}
              />
            </motion.div>
          ))}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Desktop Downloads */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <Monitor className="w-6 h-6 text-saffron" />
                <h3 className="text-xl font-display font-semibold text-warm-white">
                  {String(t('downloads.desktop.title'))}
                </h3>
              </div>
              <p className="text-gray-400 mb-4">
                {String(t('downloads.desktop.description'))}
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-saffron" />
                  {String(t('downloads.desktop.features.offline'))}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-saffron" />
                  {String(t('downloads.desktop.features.hardware'))}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-saffron" />
                  {String(t('downloads.desktop.features.reporting'))}
                </li>
              </ul>
            </div>

            {/* Mobile Downloads */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone className="w-6 h-6 text-saffron" />
                <h3 className="text-xl font-display font-semibold text-warm-white">
                  {String(t('downloads.mobile.title'))}
                </h3>
              </div>
              <p className="text-gray-400 mb-4">
                {String(t('downloads.mobile.description'))}
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-saffron" />
                  {String(t('downloads.mobile.features.notifications'))}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-saffron" />
                  {String(t('downloads.mobile.features.menuUpdates'))}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-saffron" />
                  {String(t('downloads.mobile.features.analytics'))}
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-16"
        >
          <p className="text-gray-400">
            {String(t('downloads.help.text'))}{' '}
            <a
              href={`/${locale}/contact`}
              className="text-saffron hover:text-saffron-light transition-colors underline"
            >
              {String(t('downloads.help.link'))}
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
