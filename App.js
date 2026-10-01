import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  SafeAreaView,
  Animated,
  Image,
  Alert,
  Modal,
  ScrollView,
  Share,
  Switch,
  StatusBar,
  AppState,
  Linking,
  Dimensions
} from 'react-native';
import { useEventListener } from 'expo';
import { BlurView } from 'expo-blur';
import { useAudioPlayer } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationBar } from 'expo-navigation-bar';
import * as LocalAuthentication from 'expo-local-authentication';

const CURRENCIES = [
  { id: 'USD', name: 'Dólar estadounidense', symbol: '$' },
  { id: 'EUR', name: 'Euro', symbol: '€' },
  { id: 'JPY', name: 'Yen japonés', symbol: '¥' },
  { id: 'GBP', name: 'Libra esterlina', symbol: '£' },
  { id: 'CHF', name: 'Franco suizo', symbol: 'CHF' },
  { id: 'CNY', name: 'Yuan chino', symbol: '¥' },
  { id: 'AUD', name: 'Dólar australiano', symbol: '$' },
  { id: 'CAD', name: 'Dólar canadiense', symbol: '$' },
  { id: 'MAD', name: 'Dirham marroquí', symbol: 'د.م.' },
  { id: 'NOK', name: 'Corona noruega', symbol: 'kr' },
  { id: 'SEK', name: 'Corona sueca', symbol: 'kr' },
  { id: 'DKK', name: 'Corona danesa', symbol: 'kr' },
  { id: 'PLN', name: 'Zloty polaco', symbol: 'zł' },
  { id: 'TRY', name: 'Lira turca', symbol: '₺' },
  { id: 'BRL', name: 'Real brasileño', symbol: 'R$' },
  { id: 'ARS', name: 'Peso argentino', symbol: '$' },
  { id: 'COP', name: 'Peso colombiano', symbol: '$' },
  { id: 'CLP', name: 'Peso chileno', symbol: '$' },
  { id: 'PEN', name: 'Sol peruano', symbol: 'S/' },
  { id: 'UYU', name: 'Peso uruguayo', symbol: '$' },
];

// --- MOTOR DE ODÓMETRO PREMIUM ---
const Odometer = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const start = 0;
    const end = Number(value) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const duration = 650; // Duración ágil y fluida
    const startTime = Date.now();
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Freno suave (ease-out)
      setDisplayValue(start + (end - start) * easeProgress);
      
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  
  return <Text>{displayValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>;
};

function SplashOverlay({ fadeAnim, onFinished }) {
  const player = useVideoPlayer(
    { assetId: require('./assets/animacion_billete.mp4') },
    (videoPlayer) => {
      videoPlayer.loop = false;
      videoPlayer.play();
    }
  );

  useEventListener(player, 'playToEnd', () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      onFinished();
    });
  });

  return (
    <Animated.View style={[styles.splashScreen, { opacity: fadeAnim }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />
    </Animated.View>
  );
}

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('Auth'); 
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const cashSound = useAudioPlayer(require('./assets/cash_sound.mp3'));

  const [isLogin, setIsLogin] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [inputName, setInputName] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [finalUserName, setFinalUserName] = useState('Usuario'); 

  const [selectedCurrencies, setSelectedCurrencies] = useState([]);
  const [showBalance, setShowBalance] = useState(false);
  const [isEditingCurrencies, setIsEditingCurrencies] = useState(false);

  const [deposits, setDeposits] = useState([]);

  const EURO_IMAGES = {
    5: require('./assets/euro_5.png'),
    10: require('./assets/euro_10.png'),
    20: require('./assets/euro_20.png'),
    50: require('./assets/euro_50.png'),
    100: require('./assets/euro_100.png'),
    200: require('./assets/euro_200.png'),
    500: require('./assets/euro_500.png'),
  };

  const [activeDeposit, setActiveDeposit] = useState({
    name: '',
    amount: 0,
    currencyId: 'EUR',
    banknotes: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 },
    history: []
  });

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [operationType, setOperationType] = useState('in'); 
  const [operationNotes, setOperationNotes] = useState({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 });
  const [operationConcept, setOperationConcept] = useState(''); 
  const [isCreateDepositModalVisible, setIsCreateDepositModalVisible] = useState(false);

  // --- 💼 ESTADOS BUSINESS: BANDEJA DE AUDITORÍA ---
  const [pendingReports, setPendingReports] = useState([]);
  
  // --- ESTADOS PREMIUM: AUTOMATIZACIÓN AVANZADA ---
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState('monthly'); 
  const [recurringDay, setRecurringDay] = useState(1); 

  // --- ESTADOS PREMIUM: METAS DE AHORRO ---
  const [customGoals, setCustomGoals] = useState({}); 
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
  const [tempGoalInput, setTempGoalInput] = useState('');

  // --- ESTADOS PREMIUM: CENTRO DE EXPORTACIÓN ---
  const [exportFormat, setExportFormat] = useState('pdf'); 
  const [exportScope, setExportScope] = useState('all'); 
  const [exportTimeRange, setExportTimeRange] = useState('current_month');
  const [exportIncludeNotes, setExportIncludeNotes] = useState(true);
  const [exportIncludeTax, setExportIncludeTax] = useState(false); 

  // --- 💼 ESTADO MAESTRO: MODO DUAL (PERSONAL / BUSINESS) ---
  const [appMode, setAppMode] = useState('personal'); 

  // Diccionario de Temas Dinámico (GLOBAL)
  const theme = {
    bg: appMode === 'business' ? '#0F172A' : '#111A42',          
    accent: appMode === 'business' ? '#059669' : '#C48A76',      
    cardBg: appMode === 'business' ? 'rgba(5, 150, 105, 0.05)' : 'rgba(216, 216, 218, 0.05)',
    cardBorder: appMode === 'business' ? 'rgba(5, 150, 105, 0.3)' : 'rgba(196, 138, 118, 0.2)',
    iconBg: appMode === 'business' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(196, 138, 118, 0.15)',
    textMain: '#D8D8DA',
    textSub: '#94A3B8',
  };

  // --- ESTADOS DEL MENÚ FLOTANTE DE AJUSTES ---
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const settingsAnim = useRef(new Animated.Value(0)).current;

  // --- ESTADOS DE LA PANTALLA DE CONFIGURACIÓN ---
  const [isFullScreen, setIsFullScreen] = useState(true); 
  const [isPrivacyDefault, setIsPrivacyDefault] = useState(false);
  const [isHapticEnabled, setIsHapticEnabled] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  // --- ESTADOS Y LÓGICA DE SEGURIDAD ---
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false);
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [userPin, setUserPin] = useState('');
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  // lockMode controla el Numpad: 'none' (oculto), 'setup' (crear), 'confirm' (repetir), 'unlock' (desbloquear)
  const [lockMode, setLockMode] = useState('none'); 
  const [tempPin, setTempPin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  // --- ESTADO DE SUSCRIPCIÓN (Simulado) ---
  const [userPlan, setUserPlan] = useState('basic'); // Puede ser: 'basic', 'premium' o 'business'
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', type: 'success' });
  const [activeBalanceIndex, setActiveBalanceIndex] = useState(0);
  const [activeChartIndex, setActiveChartIndex] = useState(0);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [animType, setAnimType] = useState('in');
  const popAnim = useRef(new Animated.Value(0)).current;
  // --- 💼 ESTADOS BUSINESS: TURNO DE CAJA ---
  const [isRegisterOpen, setIsRegisterOpen] = useState(false); // Flag maestro de turno
  const [registerOpenTime, setRegisterOpenTime] = useState(null); // Hora a la que se abrió
  const [registerOpenedBy, setRegisterOpenedBy] = useState(''); // Quién abrió la caja
  const [registerLog, setRegisterLog] = useState([]); // El libro de auditoría de cada movimiento
  const [registerBaseNotes, setRegisterBaseNotes] = useState({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 }); 
  const [registerSales, setRegisterSales] = useState(0); 
  const [registerExpenses, setRegisterExpenses] = useState(0); 
  const [registerCountedNotes, setRegisterCountedNotes] = useState({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 }); 
  const [registerStep, setRegisterStep] = useState(1); 
  
  // --- 💼 ESTADOS BUSINESS: QUICK ACTIONS TPV ---
  const [isQuickActionVisible, setIsQuickActionVisible] = useState(false);
  const [quickActionType, setQuickActionType] = useState('sale'); // 'sale' o 'expense'
  const [quickActionAmount, setQuickActionAmount] = useState('');
  
  // --- 💼 ESTADOS BUSINESS: MOTOR ANALÍTICO ---
  const [businessChartTimeframe, setBusinessChartTimeframe] = useState('month'); // 'month' o 'week'

  // --- 💼 ESTADOS BUSINESS: IDENTIDAD Y EQUIPO ---
  const [hasCompletedBusinessSetup, setHasCompletedBusinessSetup] = useState(false); // ¿Primera vez?
  const [masterPin, setMasterPin] = useState(''); // El PIN blindado del Dueño
  const [showGatekeeper, setShowGatekeeper] = useState(false); // Modal del Teclado Numérico
  const [gatekeeperPin, setGatekeeperPin] = useState(''); // Lo que se teclea en el Gatekeeper
  
  const [currentUser, setCurrentUser] = useState({ name: 'Jefe', role: 'admin' });
  const [showTeamOnboarding, setShowTeamOnboarding] = useState(false);
  const [teamSetupStep, setTeamSetupStep] = useState('decision'); // 'decision', 'master_pin', 'local_setup', 'cloud_setup'
  const [tempMasterPin, setTempMasterPin] = useState(''); // PIN temporal durante el setup
  const [teamMode, setTeamMode] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPin, setNewEmpPin] = useState('');

  // --- ESTADOS PREMIUM: AUTO-LOCK Y PÁNICO ---
  const [autoLockSetting, setAutoLockSetting] = useState(0); // 0 = inmediato, 60 = 1 min, 300 = 5 min
  const [isAutoLockInfoVisible, setIsAutoLockInfoVisible] = useState(false);
// --- ESTADOS: CENTRO DE AYUDA Y BOT ---
  const initialBotOptions = [
    'Olvidé mi código PIN',
    '¿Qué es el PIN de Pánico?',
    'Problemas con la biometría',
    '¿Mis datos se guardan en la nube?',
    '¿Cómo elimino un depósito?',
    '¿Puedo añadir más divisas?',
    '¿Cómo exporto mis movimientos?',
    'Contactar con un humano'
  ];
  const [chatMessages, setChatMessages] = useState([
    { id: 'init-1', text: '¡Hola! Soy el asistente virtual de SUELTO. ¿En qué puedo ayudarte hoy?', sender: 'bot' }
  ]);
  const [chatOptions, setChatOptions] = useState(initialBotOptions);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatScrollRef = useRef();
  // --- ESTADOS Y LÓGICA: ¿QUIÉNES SOMOS? (Typewriter Effect) ---
  const aboutP1_1 = "SUELTO nace para preservar la privacidad y la libertad financiera, valores que alcanzan su plenitud con el uso del efectivo. Nuestro impulso es simplificar la gestión de tus recursos y reivindicar el valor del dinero físico frente al rastro digital que dejan las transacciones electrónicas. Para ello un joven ingeniero desarrolló una herramienta intuitiva y segura para que cualquier usuario (persona o negocio) administre su ";
  const aboutP1_2 = "cash";
  const aboutP1_3 = " sin intermediarios.";
  const aboutP1 = aboutP1_1 + aboutP1_2 + aboutP1_3;
  const aboutP2 = "¿Alguna vez has sentido que tus billetes desaparecen como si nada? ¿Cuadrar la caja es una fuente constante de estrés y desconfianza? SUELTO elimina esa incertidumbre. Obtén el control absoluto sobre tu metálico en tiempo real: genera informes de gastos y vigila tu flujo diario con un solo vistazo.";
  const aboutP3 = "Tus registros son solo tuyos; SUELTO garantiza que tu información financiera permanezca estrictamente privada ya que lo que aparece en esta app, ¡son solo números y dibujos animados!";
  const aboutP4 = "SUELTO no es solo una app; es la potestad de elegir. Es libertad, comodidad y privacidad absoluta. Gestiona tu efectivo, gestiona tu libertad.";
  
  const [aboutCharCount, setAboutCharCount] = useState(0);

  useEffect(() => {
    if (currentScreen === 'AboutUs') {
      setAboutCharCount(0); // Reiniciar al entrar
      const totalChars = aboutP1.length + aboutP2.length + aboutP3.length + aboutP4.length;
      const duration = 13000; // 5 segundos exactos
      const intervalMs = 40; // Tasa de refresco (25 frames por segundo)
      const steps = duration / intervalMs;
      const charsPerStep = Math.ceil(totalChars / steps);

      const timer = setInterval(() => {
        setAboutCharCount(prev => {
          if (prev + charsPerStep >= totalChars) {
            clearInterval(timer);
            return totalChars;
          }
          return prev + charsPerStep;
        });
      }, intervalMs);

      return () => clearInterval(timer);
    }
  }, [currentScreen]);

  const handleEmailSupport = () => {
    Linking.openURL('mailto:suelto.app@gmail.com?subject=Soporte%20SUELTO%20');
  };

  const handleChatOption = (option) => {
    const newUserMsg = { id: Date.now().toString(), text: option, sender: 'user' };
    setChatMessages(prev => [...prev, newUserMsg]);
    setChatOptions([]); 
    setIsBotTyping(true);

    setTimeout(() => {
      let botResponse = '';
      let nextOptions = ['Nueva consulta', 'Contactar con un humano'];

      if (option === 'Olvidé mi código PIN') {
        botResponse = 'Por privacidad y seguridad, nosotros no guardamos tu PIN en ningún servidor. Si no lo recuerdas, tendrás que ir a los Ajustes de tu móvil, borrar los datos de la app y volver a configurarla. (Tus depósitos se pondrán a 0).';
      } else if (option === '¿Qué es el PIN de Pánico?') {
        botResponse = 'Es un código falso. Si alguien te obliga a abrir la app bajo presión, introduces ese PIN y la app se abrirá simulando estar vacía, borrando todos tus depósitos al instante para proteger tu información.';
      } else if (option === 'Problemas con biometría') {
        botResponse = 'Asegúrate de tener la huella o FaceID activado en los ajustes de tu teléfono. Si el sensor falla, la app siempre te pedirá tu PIN de 4 dígitos como respaldo.';
      } else if (option === '¿Mis datos se guardan en la nube?') {
        botResponse = 'No, predeterminadamente se guardan únicamente en este dispositivo. Para acceder a esta función y poder traspasar tus datos de un dispositivo a otro, incluso en caso de pérdida, debes obtener Suelto PREMIUM o BUSINESS .';
      } else if (option === '¿Cómo elimino un depósito?') {
        botResponse = 'Es muy sencillo. Ve a la pantalla "Mis Depósitos" y mantén el dedo pulsado (pulsación larga) sobre el depósito que quieras borrar. Aparecerá un aviso de seguridad para confirmar la eliminación.';
      } else if (option === '¿Puedo añadir más divisas?') {
        botResponse = '¡Por supuesto! La selección de divisas no es definitiva. Podrás editar las monedas con las que operas en cualquier momento desde el menú principal de la app.';
      } else if (option === '¿Cómo exporto mis movimientos?') {
        botResponse = 'Desde la pantalla de Configuración, en el apartado de "Gestión de Datos", tienes la opción de exportar tus balances y gráficas en formato PDF o Excel. Ten en cuenta que es una función de Suelto PREMIUM o BUSINESS.';
      } else if (option === 'Contactar con un humano') {
        botResponse = 'Entendido. Puedes enviarnos un correo electrónico a suelto.app@gmail.com y nuestro equipo te responderá lo antes posible.';
        nextOptions = ['Enviar correo ahora', 'Nueva consulta'];
      } else if (option === 'Enviar correo ahora') {
        botResponse = '¡Perfecto! Abriendo tu aplicación de correo...';
        nextOptions = ['Nueva consulta'];
        handleEmailSupport();
      } else {
        botResponse = 'Menú principal. ¿Hay algo más en lo que pueda ayudarte?';
        nextOptions = initialBotOptions;
      }

      const newBotMsg = { id: (Date.now() + 1).toString(), text: botResponse, sender: 'bot' };
      setChatMessages(prev => [...prev, newBotMsg]);
      setChatOptions(nextOptions);
      setIsBotTyping(false);
    }, 1200); 
  };
  const [panicPin, setPanicPin] = useState('');
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef(null);

  // Detector de Segundo Plano (Privacidad y Auto-Lock)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Si la app pasa a segundo plano (se minimiza)
      if (appState.current.match(/active/) && (nextAppState === 'inactive' || nextAppState === 'background')) {
        backgroundTime.current = Date.now();
        // Si el bloqueo es inmediato, forzamos la pantalla de bloqueo para que se vea en el carrusel del móvil (Privacidad)
        if (isPinEnabled && autoLockSetting === 0) {
          setLockMode('unlock');
        }
      }

      // Si la app vuelve a primer plano
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isPinEnabled && backgroundTime.current) {
          const elapsedSeconds = (Date.now() - backgroundTime.current) / 1000;
          if (elapsedSeconds >= autoLockSetting) {
            setLockMode('unlock');
            // Lanzamos biometría automáticamente al volver si está activa
            if (isBiometricEnabled) {
              setTimeout(() => handleBiometricAuth(), 500);
            }
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isPinEnabled, autoLockSetting, isBiometricEnabled]);

  // Detectar si el móvil tiene huella o FaceID al arrancar
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setHasBiometricHardware(compatible);
    })();
  }, []);

  const handleBiometricAuth = async () => {
    const savedBiometrics = await LocalAuthentication.isEnrolledAsync();
    if (!savedBiometrics) {
      return Alert.alert('Aviso', 'No tienes huella o FaceID configurado en los ajustes de tu móvil.');
    }
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquea SUELTO',
      fallbackLabel: 'Usar PIN',
      disableDeviceFallback: true,
    });
    if (auth.success) {
      setLockMode('none');
      setEnteredPin('');
      if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleRoute1 = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentScreen('DepositsList');
  };
  const handleRoute2 = () => Alert.alert("Tienda", "Cargando el catálogo de la tienda...");
  const handleRoute3 = () => Alert.alert("Mejorar Plan", "Desplegando opciones premium...");

  // --- LÓGICA DEL MENÚ FLOTANTE ---
  const openSettings = () => {
    setIsSettingsVisible(true);
    Animated.spring(settingsAnim, {
      toValue: 1,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const closeSettings = (callback) => {
    Animated.timing(settingsAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsSettingsVisible(false);
      if (typeof callback === 'function') callback();
    });
  };

  const handleShare = async () => {
    closeSettings();
    try {
      // Enlaces temporales (A cambiar cuando la app esté publicada)
      const appStoreLink = 'https://apps.apple.com/app/id0000000000'; 
      const playStoreLink = 'https://play.google.com/store/apps/details?id=com.tuempresa.suelto'; 
      
      // Detectamos el sistema del usuario que recibe/envía
      const storeLink = Platform.OS === 'ios' ? appStoreLink : playStoreLink;

      await Share.share({
        message: `¡Descubre SUELTO! La mejor app para gestionar tu dinero en efectivo. Gestiona tu efectivo, gestiona tu libertad 🚀\n\nDescárgala aquí: ${storeLink}`
      });
    } catch (error) {
      console.log(error);
    }
  };

const handlePinPress = (digit) => {
    if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    let current = enteredPin;
    if (digit === 'del') {
      current = current.slice(0, -1);
    } else if (current.length < 4) {
      current += digit;
    }
    setEnteredPin(current);

    if (current.length === 4) {
      setTimeout(() => {
        if (lockMode === 'setup') {
          setTempPin(current);
          setEnteredPin('');
          setLockMode('confirm');
        } else if (lockMode === 'confirm') {
          if (current === tempPin) {
            setUserPin(current);
            setIsPinEnabled(true);
            setLockMode('none');
            setEnteredPin('');
            setCustomAlert({ visible: true, title: 'SEGURIDAD ACTIVADA', message: 'Tu PIN de seguridad se ha guardado correctamente.', type: 'success' });
          } else {
            if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setCustomAlert({ visible: true, title: 'Error', message: 'Los códigos PIN no coinciden. Vuelve a intentarlo.', type: 'error' });
            setEnteredPin('');
            setLockMode('setup');
          }
        } else if (lockMode === 'panic-setup') {
          if (current === userPin) {
            setCustomAlert({ visible: true, title: 'Aviso', message: 'El PIN de pánico no puede ser igual al PIN principal.', type: 'error' });
            setEnteredPin('');
            return;
          }
          setTempPin(current);
          setEnteredPin('');
          setLockMode('panic-confirm');
        } else if (lockMode === 'panic-confirm') {
          if (current === tempPin) {
            setPanicPin(current);
            setLockMode('none');
            setEnteredPin('');
            setCustomAlert({ visible: true, title: 'PIN de Pánico Activo', message: 'Si introduces este código, tus depósitos se borrarán al instante.', type: 'success' });
          } else {
            if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setCustomAlert({ visible: true, title: 'Error', message: 'Los códigos no coinciden.', type: 'error' });
            setEnteredPin('');
            setLockMode('panic-setup');
          }
        } else if (lockMode === 'unlock') {
          if (current === userPin) {
            setLockMode('none');
            setEnteredPin('');
            if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else if (panicPin !== '' && current === panicPin) {
            // 🚨 AUTODESTRUCCIÓN SILENCIOSA 🚨
            setDeposits([]);
            setActiveDeposit({ name: '', amount: 0, currencyId: 'EUR', banknotes: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 }, history: [] });
            setLockMode('none');
            setEnteredPin('');
            if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
          } else {
            if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setCustomAlert({ visible: true, title: 'Acceso Denegado', message: 'PIN incorrecto.', type: 'error' });
            setEnteredPin('');
          }
        }
      }, 300);
    }
  };
  // --- INICIALIZACIÓN MODO INMERSIVO Y ORIENTACIÓN ---
  useEffect(() => {
    async function lockAppLayout() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        if (Platform.OS === 'android') {
          NavigationBar.setHidden(true);
        }
      } catch (error) {
        console.log("Error configurando el layout inicial:", error);
      }
    }
    lockAppLayout();
  }, []);

  // Lógica: Si volvemos al Dashboard y la privacidad está activa, ocultamos el saldo.
  useEffect(() => {
    if (currentScreen === 'Dashboard' && isPrivacyDefault) {
      setShowBalance(false);
    }
  }, [currentScreen, isPrivacyDefault]);

  const toggleForm = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsLogin(!isLogin);
    setTermsAccepted(false);
  };

  const openTermsAndConditions = () => {
    Alert.alert("Documento Legal", "Aquí se abrirá el PDF con los Términos.");
  };

  const handleAuth = () => {
    if (!isLogin && !termsAccepted) {
      Alert.alert("Acción Requerida", "Acepta los Términos y Condiciones para continuar.");
      return;
    }

    setIsLoading(true);
    let nameToSave = 'Usuario';
    if (!isLogin && inputName.trim() !== '') {
      nameToSave = inputName.trim();
    } else if (isLogin && inputEmail.trim() !== '') {
      let extractedName = inputEmail.split('@')[0];
      nameToSave = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
    }

    setTimeout(() => {
      setIsLoading(false);
      setFinalUserName(nameToSave); 
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentScreen('CurrencySelection');
    }, 1500);
  };

  const handleSocialAuth = (provider) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setFinalUserName(`Usuario de ${provider}`); 
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentScreen('CurrencySelection');
    }, 1500);
  };

  const toggleCurrency = (currencyId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCurrencies((prevSelected) => {
      if (prevSelected.includes(currencyId)) {
        return prevSelected.filter(id => id !== currencyId);
      } else {
        return [...prevSelected, currencyId];
      }
    });
  };

  const handleContinueCurrencies = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentScreen('Dashboard');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Buenos días';
    if (hour >= 12 && hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const toggleBalance = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowBalance(!showBalance);
  };

  const handleLogout = () => {
    closeSettings(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentScreen('Auth'); 
      setIsLogin(true); 
    });
  };

  const handleSettingsOption = (option) => {
    closeSettings(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (option === 'Configuración') {
        setCurrentScreen('Settings');
      } else if (option === 'Seguridad') {
        setCurrentScreen('Security');
      } else if (option === 'Centro de ayuda') {
        setCurrentScreen('HelpCenter');
      } else if (option === '¿Quiénes somos?') {
        setCurrentScreen('AboutUs');
      } else if (option === 'Información sobre planes') {
        setCurrentScreen('Plans');
      } else {
        Alert.alert(option, `Próximamente abriremos la pantalla de ${option}.`);
      }
    });
  };

  // --- 💼 FILTRO MAESTRO DE BÓVEDAS ---
  // Filtramos para mostrar solo las bóvedas del modo actual.
  // (Si una bóveda antigua no tiene etiqueta, la asume como 'personal')
  const activeDeposits = deposits.filter(d => (d.type || 'personal') === appMode);

  const getBalancesList = () => {
    if (selectedCurrencies.length === 0) return [{ currency: 'EUR', total: 0, symbol: '€' }];
    return selectedCurrencies.map(currencyId => {
      const total = activeDeposits
        .filter(dep => dep.currencyId === currencyId)
        .reduce((acc, dep) => {
          const num = typeof dep.amount === 'string' ? parseFloat(dep.amount.replace(/,/g, '')) : (dep.amount || 0);
          return acc + num;
        }, 0);
      const symbol = CURRENCIES.find(c => c.id === currencyId)?.symbol || currencyId;
      return { currency: currencyId, total, symbol };
    });
  };

  const handleNoteChange = (denomination, action) => {
    if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOperationNotes(prev => {
      const currentCount = prev[denomination];
      let newCount = currentCount;

      if (action === 'add') {
        if (operationType === 'out' && currentCount >= (activeDeposit.banknotes[denomination] || 0)) {
          return prev;
        }
        newCount = currentCount + 1;
      } else if (action === 'sub' && currentCount > 0) {
        newCount = currentCount - 1;
      }
      return { ...prev, [denomination]: newCount };
    });
  };

  const getOperationTotal = () => {
    return Object.entries(operationNotes).reduce((acc, [denom, count]) => {
      return acc + (Number(denom) * count);
    }, 0);
  };

  const confirmOperation = () => {
    const operationAmount = getOperationTotal();
    if (operationAmount === 0) {
      Alert.alert("Aviso", "Añade al menos un billete para operar.");
      return;
    }

    const currentTotal = typeof activeDeposit.amount === 'string' ? parseFloat(activeDeposit.amount.replace(/,/g, '')) : activeDeposit.amount;
    const newTotal = operationType === 'in' ? currentTotal + operationAmount : currentTotal - operationAmount;

    const newBanknotes = { ...activeDeposit.banknotes };
    Object.entries(operationNotes).forEach(([denom, count]) => {
      if (count > 0) {
        if (operationType === 'in') {
          newBanknotes[denom] = (newBanknotes[denom] || 0) + count;
        } else {
          newBanknotes[denom] = Math.max(0, (newBanknotes[denom] || 0) - count);
        }
      }
    });

    const now = new Date();
    const dateString = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} - ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newHistoryEntry = {
      id: Date.now().toString(),
      type: operationType,
      amount: operationAmount,
      concept: operationConcept.trim(),
      notes: Object.fromEntries(Object.entries(operationNotes).filter(([_, count]) => count > 0)), 
      balanceAfter: newTotal,
      date: dateString
    };

    const updatedDeposit = { 
      ...activeDeposit, 
      amount: newTotal, 
      banknotes: newBanknotes,
      history: [newHistoryEntry, ...(activeDeposit.history || [])]
    };
    
    // 1. Actualización Local (Instantánea, sin lag)
    setActiveDeposit(updatedDeposit);
    setDeposits(prev => prev.map(d => d.id === updatedDeposit.id ? updatedDeposit : d));
    
    // 2. MAGIA PREMIUM: Sincronización en la nube silenciosa
    if (userPlan === 'premium' || userPlan === 'business') {
      // Arquitectura: Aquí inyectaremos await supabase.from('deposits').upsert(updatedDeposit)
      console.log("☁️ [Supabase Sync] Subiendo movimiento a la nube en segundo plano...");
    }
    
    setIsModalVisible(false);
    setOperationNotes({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 });
    setOperationConcept(''); 
    setIsRecurring(false);
    setRecurringFreq('monthly'); // Reset 
    setRecurringDay(1); // Reset

    // --- RECOMPENSAS SENSORIALES AL CONFIRMAR ---
    setAnimType(operationType);
    setShowSuccessAnim(true);
    
    // Animación de rebote (Spring)
    Animated.spring(popAnim, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true
    }).start();

    if (isHapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);
    }

    if (isSoundEnabled) {
      (async () => {
        try {
          cashSound.seekTo(0);
          cashSound.play();
        } catch (error) {
          console.log("Sin sonido");
        }
      })();
    }

    // Cerramos la animación suavemente después de 1.5 segundos
    setTimeout(() => {
      Animated.timing(popAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start(() => setShowSuccessAnim(false));
    }, 1500);
  };

// --- LÓGICA DINÁMICA DE GRÁFICOS ---
  const getFlowData = () => {
    let totalIn = 0;
    let totalOut = 0;
    activeDeposits.forEach(dep => {
      if (dep.history) {
        dep.history.forEach(mov => {
          if (mov.type === 'in') totalIn += mov.amount;
          if (mov.type === 'out') totalOut += mov.amount;
        });
      }
    });
    const total = totalIn + totalOut;
    if (total === 0) return { inPerc: 0, outPerc: 0, hasData: false }; 
    return {
      inPerc: Math.round((totalIn / total) * 100),
      outPerc: Math.round((totalOut / total) * 100),
      hasData: true
    };
  };

  const getProgressData = () => {
    if (activeDeposits.length === 0) return { id: null, name: 'Sin bóvedas', perc: 0, amount: 0, goal: 0 };
    const mainDep = activeDeposits[0]; 
    const amount = typeof mainDep.amount === 'string' ? parseFloat(mainDep.amount.replace(/,/g, '')) : (mainDep.amount || 0);
    
    let goal = customGoals[mainDep.id] || (Math.ceil(amount / 1000) * 1000);
    if (goal === 0) goal = 1000;
    if (amount === goal && !customGoals[mainDep.id]) goal += 1000; 
    
    const perc = Math.round((amount / goal) * 100);
    return { 
      id: mainDep.id, 
      name: mainDep.name || 'Bóveda Principal', 
      perc: Math.min(perc, 100), 
      amount, 
      goal,
      currencyId: mainDep.currencyId
    };
  };

  const getDistributionData = () => {
    if (activeDeposits.length === 0) return [];
    const totalBalance = activeDeposits.reduce((acc, dep) => {
      const amt = typeof dep.amount === 'string' ? parseFloat(dep.amount.replace(/,/g, '')) : (dep.amount || 0);
      return acc + amt;
    }, 0);
    
    if (totalBalance === 0) return [];

    const sorted = [...activeDeposits].sort((a,b) => {
      const aAmt = typeof a.amount === 'string' ? parseFloat(a.amount.replace(/,/g, '')) : (a.amount || 0);
      const bAmt = typeof b.amount === 'string' ? parseFloat(b.amount.replace(/,/g, '')) : (b.amount || 0);
      return bAmt - aAmt;
    }).slice(0, 3); 

    const colors = ['#C48A76', '#4CAF50', '#2196F3'];
    
    return sorted.map((dep, index) => {
      const amt = typeof dep.amount === 'string' ? parseFloat(dep.amount.replace(/,/g, '')) : (dep.amount || 0);
      const perc = Math.round((amt / totalBalance) * 100);
      return { name: dep.name || `Depósito ${index+1}`, perc, color: colors[index] };
    });
  };

  const flowData = getFlowData();
  const progressData = getProgressData();
  const distData = getDistributionData();
  // ------------------------------------

  return (
    <GestureHandlerRootView style={[styles.mainWrapper, currentScreen !== 'Auth' && { backgroundColor: theme.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Control dinámico de la barra de estado del teléfono */}
        <StatusBar hidden={isFullScreen} barStyle={currentScreen === 'Auth' ? 'dark-content' : 'light-content'} />

        {/* PANTALLA 1: LOGIN / REGISTRO */}
        {currentScreen === 'Auth' && (
          <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
            <View style={styles.logoContainer}>
              <Image source={require('./assets/image_e9d0a5.jpg')} style={styles.smallLogo} resizeMode="cover" />
              <Text style={styles.appName}>SUELTO</Text>
              <Text style={styles.subtitle}>{isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta segura'}</Text>
            </View>

            <View style={styles.formContainer}>
              {!isLogin && (
                <>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="Nombre completo" 
                      placeholderTextColor="#94A3B8" 
                      value={inputName}
                      onChangeText={setInputName}
                    />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="at-circle-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Nombre de usuario" placeholderTextColor="#94A3B8" autoCapitalize="none" />
                  </View>
                </>
              )}
              
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Correo electrónico" 
                  placeholderTextColor="#94A3B8" 
                  keyboardType="email-address" 
                  autoCapitalize="none" 
                  value={inputEmail}
                  onChangeText={setInputEmail}
                />
              </View>
              
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#94A3B8" secureTextEntry />
              </View>

              {!isLogin && (
                <View style={styles.termsContainer}>
                  <TouchableOpacity style={[styles.checkbox, termsAccepted && styles.checkboxChecked]} onPress={() => setTermsAccepted(!termsAccepted)} activeOpacity={0.8}>
                    {termsAccepted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <Text style={styles.termsText}>Acepto los <Text style={styles.termsLink} onPress={openTermsAndConditions}>Términos, Condiciones y Política de Privacidad</Text></Text>
                </View>
              )}

              <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={isLoading}>
                <Text style={styles.primaryButtonText}>{isLoading ? 'Conectando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}</Text>
              </TouchableOpacity>

              {isLogin && (
                <View style={styles.socialContainer}>
                  <Text style={styles.socialText}>O continúa con</Text>
                  <View style={styles.socialButtonsRow}>
                    <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialAuth('Google')}><FontAwesome5 name="google" size={20} color="#DB4437" /></TouchableOpacity>
                    <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialAuth('Apple')}><FontAwesome5 name="apple" size={22} color="#000000" /></TouchableOpacity>
                    <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialAuth('Facebook')}><FontAwesome5 name="facebook" size={22} color="#4267B2" /></TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.footerContainer}>
                <Text style={styles.footerText}>{isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes una cuenta? '}</Text>
                <TouchableOpacity onPress={toggleForm} disabled={isLoading}><Text style={styles.footerLink}>{isLogin ? 'Regístrate' : 'Inicia Sesión'}</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* PANTALLA 2: SELECCIÓN DE DIVISAS */}
        {/* PANTALLA 2: SELECCIÓN DE DIVISAS */}
        {currentScreen === 'CurrencySelection' && (
          <View style={styles.currencyContainer}>
            <View style={[styles.currencyHeader, isEditingCurrencies && {flexDirection: 'row', alignItems: 'center'}]}>
              {isEditingCurrencies && (
                <TouchableOpacity 
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setCurrentScreen('Dashboard');
                    setIsEditingCurrencies(false);
                  }} 
                  style={[styles.backArrowBtn, { marginRight: 16, marginTop: 0 }]}
                  hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                >
                  <Ionicons name="chevron-back" size={22} color="#D8D8DA" style={{ marginLeft: -2 }} />
                </TouchableOpacity>
              )}
              <View style={isEditingCurrencies ? { flex: 1 } : {}}>
                <Text style={styles.currencyTitle}>
                  {isEditingCurrencies ? 'MIS DIVISAS' : '¿Con qué divisas vas a operar?'}
                </Text>
                <Text style={styles.currencySubtitle}>
                  {isEditingCurrencies 
                    ? 'Añade o elimina monedas de tu cartera física.' 
                    : 'Selecciona una o más opciones para configurar tu cartera física.'}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridContainer}>
              {CURRENCIES.map((currency) => {
                const isSelected = selectedCurrencies.includes(currency.id);
                return (
                  <TouchableOpacity key={currency.id} activeOpacity={0.7} onPress={() => toggleCurrency(currency.id)} style={[styles.currencyCard, isSelected && styles.currencyCardSelected]}>
                    <Text style={[styles.currencySymbol, isSelected && styles.textSelected]}>{currency.symbol}</Text>
                    <Text style={[styles.currencyCode, isSelected && styles.textSelected]}>{currency.id}</Text>
                    <Text style={[styles.currencyName, isSelected && styles.textSelected]} numberOfLines={1}>{currency.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.bottomBar}>
              <TouchableOpacity style={[styles.continueButton, selectedCurrencies.length === 0 && styles.continueButtonDisabled]} onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setCurrentScreen('Dashboard');
                setIsEditingCurrencies(false);
              }} disabled={selectedCurrencies.length === 0}>
                <Text style={styles.continueButtonText}>
                  {selectedCurrencies.length === 0 ? 'Selecciona al menos una' : (isEditingCurrencies ? `Guardar cambios (${selectedCurrencies.length})` : `Continuar (${selectedCurrencies.length})`)}
                </Text>
                {selectedCurrencies.length > 0 && <Ionicons name={isEditingCurrencies ? "checkmark" : "arrow-forward"} size={20} color="#111A42" style={{marginLeft: 8}} />}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PANTALLA 3: DASHBOARD DINÁMICO (PERSONAL / BUSINESS) */}
        {currentScreen === 'Dashboard' && (
          <View style={[styles.dashboardContainer, { backgroundColor: theme.bg }]}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              style={{ flex: 1 }}
            >
              
              {/* --- CABECERA COMPARTIDA --- */}
              <View style={styles.dashHeader}>
                <View>
                  <Text style={styles.dashGreeting}>{getGreeting()},</Text>
                  <Text style={styles.dashTitle}>{finalUserName}</Text>
                  
                  {/* INTERRUPTOR MAESTRO (Oculto para empleados) */}
                  {userPlan === 'business' && currentUser.role === 'admin' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: theme.cardBorder }}
                        onPress={() => {
                          if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          
                          if (appMode === 'personal') {
                            if (!hasCompletedBusinessSetup) {
                              // Primera vez: Lanza el Onboarding Maestro
                              setTeamSetupStep('decision');
                              setTeamMode(null);
                              setShowTeamOnboarding(true);
                            } else {
                              // Rutina diaria: Lanza el Gatekeeper (Teclado Numérico)
                              setShowGatekeeper(true);
                              setGatekeeperPin('');
                            }
                          } else {
                            // Volver al modo Personal
                            setAppMode('personal');
                            setCurrentUser({ name: finalUserName, role: 'admin' });
                          }
                        }}
                      >
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginRight: 6 }} />
                        <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
                          {appMode === 'business' ? 'MODO NEGOCIO' : 'MODO PERSONAL'}
                        </Text>
                        <Ionicons name="swap-horizontal" size={14} color={theme.accent} style={{ marginLeft: 8 }} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={styles.avatarBtn} onPress={openSettings} activeOpacity={0.8}>
                  <Image source={require('./assets/image_e9d0a5.jpg')} style={[styles.avatarImage, { borderColor: theme.accent }]} />
                  <View style={[styles.avatarBadge, { backgroundColor: theme.accent }]}>
                    <FontAwesome5 name="cog" size={15} color="#111A42" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* --- TARJETA DE SALDO COMPARTIDA --- */}
              <View style={[styles.premiumCard, { paddingHorizontal: 0, paddingBottom: 20, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <View style={[styles.balanceHeader, { paddingHorizontal: 24 }]}>
                  <Text style={styles.balanceLabel}>
                    {appMode === 'business' ? 'CAJA TOTAL DEL NEGOCIO' : 'SALDO TOTAL'}
                  </Text>
                  <TouchableOpacity onPress={toggleBalance} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <Ionicons name={showBalance ? "eye-off-outline" : "eye-outline"} size={22} color={theme.accent} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => { const slideSize = Dimensions.get('window').width - 48; setActiveBalanceIndex(Math.round(e.nativeEvent.contentOffset.x / slideSize)); }}>
                  {getBalancesList().map((bal) => {
                    const fullCurrencyName = CURRENCIES.find(c => c.id === bal.currency)?.name || bal.currency;
                    return (
                      <View key={bal.currency} style={{ width: Dimensions.get('window').width - 48, paddingHorizontal: 24 }}>
                        <Text style={[styles.balanceAmount, { marginBottom: 12 }]}>
                          {showBalance ? <Odometer value={bal.total} /> : "• • • • • • "}
                          <Text style={{ color: theme.accent, fontSize: 32 }}>{bal.symbol}</Text>
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={styles.currenciesRow}>
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>{fullCurrencyName}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
                
                {getBalancesList().length > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
                    {getBalancesList().map((_, idx) => (
                      <View key={`dot-${idx}`} style={{ width: activeBalanceIndex === idx ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: activeBalanceIndex === idx ? theme.accent : 'rgba(216, 216, 218, 0.2)', marginHorizontal: 4 }} />
                    ))}
                  </View>
                )}
              </View>

              {/* ========================================= */}
              {/* === BIFURCACIÓN DE INTERFAZ POR MODO ==== */}
              {/* ========================================= */}

              {appMode === 'personal' ? (
                /* --- LAYOUT 1: MODO PERSONAL (El de siempre, pero teñido) --- */
                <>
                  {/* 1. Mis Depósitos */}
                  <TouchableOpacity 
                    style={[styles.premiumCard, { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 2, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder }]}
                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentScreen('DepositsList'); }}
                    activeOpacity={0.8}
                  >
                    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                      <Ionicons name="shield-checkmark" size={28} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textMain, fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>Mis depósitos</Text>
                      <Text style={{ color: theme.textSub, fontSize: 13 }}>Gestionar efectivo y bóvedas</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={theme.accent} />
                  </TouchableOpacity>

                  {/* 2. Análisis de Efectivo (Carrusel Personal) */}
                  <View style={[styles.premiumCard, { paddingHorizontal: 0, paddingVertical: 18, marginTop: 2, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                      <Text style={styles.balanceLabel}>ANÁLISIS DE EFECTIVO</Text>
                      <Ionicons name="analytics" size={20} color={theme.accent} />
                    </View>

                    <ScrollView 
                      horizontal 
                      pagingEnabled 
                      showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={(e) => {
                        const slideSize = Dimensions.get('window').width - 48;
                        const index = Math.round(e.nativeEvent.contentOffset.x / slideSize);
                        setActiveChartIndex(index);
                      }}
                    >
                      {/* GRÁFICO 1: FLUJO */}
                      <View style={{ width: Dimensions.get('window').width - 48, paddingHorizontal: 24 }}>
                        <Text style={{ color: theme.textMain, fontSize: 13, fontWeight: '600', marginBottom: 12 }}>Flujo histórico</Text>
                        
                        <View style={{ marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: theme.textSub, fontSize: 12 }}>Ingresos</Text>
                            <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: 'bold' }}>
                              {flowData.hasData ? `+${flowData.inPerc}%` : '0%'}
                            </Text>
                          </View>
                          <View style={{ height: 8, backgroundColor: 'rgba(76, 175, 80, 0.2)', borderRadius: 4 }}>
                            <View style={{ width: `${flowData.hasData ? flowData.inPerc : 0}%`, height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 }} />
                          </View>
                        </View>

                        <View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: theme.textSub, fontSize: 12 }}>Salidas</Text>
                            <Text style={{ color: '#F44336', fontSize: 12, fontWeight: 'bold' }}>
                              {flowData.hasData ? `-${flowData.outPerc}%` : '0%'}
                            </Text>
                          </View>
                          <View style={{ height: 8, backgroundColor: 'rgba(244, 67, 54, 0.2)', borderRadius: 4 }}>
                            <View style={{ width: `${flowData.hasData ? flowData.outPerc : 0}%`, height: '100%', backgroundColor: '#F44336', borderRadius: 4 }} />
                          </View>
                        </View>
                      </View>

                      {/* GRÁFICO 2: METAS (INTERACTIVO PREMIUM) */}
                      <TouchableOpacity 
                        style={{ width: Dimensions.get('window').width - 48, paddingHorizontal: 24 }}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (progressData.id === null) return;
                          if (userPlan === 'basic') {
                            if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            setCustomAlert({ 
                              visible: true, 
                              title: 'METAS AVANZADAS', 
                              message: 'Fija metas de ahorro personalizadas para tus bóvedas y sigue tu progreso al milímetro.\n\nMejora tu plan para desbloquear.', 
                              type: 'error' 
                            });
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setCurrentScreen('Plans');
                          } else {
                            if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setTempGoalInput(progressData.goal.toString());
                            setIsGoalModalVisible(true);
                          }
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <Text style={{ color: theme.textMain, fontSize: 13, fontWeight: '600' }}>Progreso de Bóvedas</Text>
                          {userPlan !== 'basic' && <View style={{backgroundColor: theme.iconBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8}}><Text style={{color: theme.accent, fontSize: 10, fontWeight: 'bold'}}>EDITAR META</Text></View>}
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                            <Text style={{ color: theme.textSub, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{progressData.name}</Text>
                            {progressData.id !== null && (
                              <Text style={{ color: theme.textSub, fontSize: 10, marginLeft: 6 }}>
                                ({progressData.amount.toLocaleString('en-US', {maximumFractionDigits: 0})} / {progressData.goal.toLocaleString('en-US', {maximumFractionDigits: 0})})
                              </Text>
                            )}
                          </View>
                          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold', marginLeft: 8 }}>{progressData.perc}%</Text>
                        </View>
                        
                        <View style={{ height: 12, backgroundColor: theme.iconBg, borderRadius: 6, overflow: 'hidden' }}>
                           <View style={{ width: `${progressData.perc}%`, height: '100%', backgroundColor: theme.accent, borderRadius: 6 }} />
                        </View>
                      </TouchableOpacity>

                      {/* GRÁFICO 3: ECOSISTEMA */}
                      <View style={{ width: Dimensions.get('window').width - 48, paddingHorizontal: 24 }}>
                        <Text style={{ color: theme.textMain, fontSize: 13, fontWeight: '600', marginBottom: 12 }}>Distribución del Efectivo</Text>
                        
                        {distData.length === 0 ? (
                          <Text style={{ color: theme.textSub, fontSize: 12, textAlign: 'center', marginTop: 10 }}>Ingresa efectivo para ver tu distribución.</Text>
                        ) : (
                          <>
                            <View style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden', flexDirection: 'row', marginBottom: 12 }}>
                              {distData.map((d, i) => (
                                <View key={`bar-${i}`} style={{ width: `${d.perc}%`, height: '100%', backgroundColor: d.color }} />
                              ))}
                            </View>
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                              {distData.map((d, i) => (
                                <View key={`leg-${i}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: d.color, marginRight: 6 }} />
                                  <Text numberOfLines={1} style={{ maxWidth: 70, color: theme.textSub, fontSize: 11 }}>{d.name}</Text>
                                </View>
                              ))}
                            </View>
                          </>
                        )}
                      </View>
                    </ScrollView>

                    {/* Puntos (Dots) del carrusel */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
                      {[0, 1, 2].map((_, idx) => (
                        <View key={`chart-dot-${idx}`} style={{ width: activeChartIndex === idx ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: activeChartIndex === idx ? theme.accent : 'rgba(216, 216, 218, 0.2)', marginHorizontal: 3 }} />
                      ))}
                    </View>
                  </View>
                  {/* 3. Tienda */}
                  <TouchableOpacity style={[styles.premiumCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginTop: 8, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={() => console.log('Tienda')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="cart-outline" size={20} color={theme.accent} />
                      </View>
                      <Text style={{ color: theme.textMain, fontSize: 16, fontWeight: '500' }}>Tienda</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSub} />
                  </TouchableOpacity>

                  {/* 4. Mis divisas */}
                  <TouchableOpacity style={[styles.premiumCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginTop: 8, marginBottom: 24, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={() => { setIsEditingCurrencies(true); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentScreen('CurrencySelection'); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="cash-outline" size={20} color={theme.accent} />
                      </View>
                      <Text style={{ color: theme.textMain, fontSize: 16, fontWeight: '500' }}>Mis divisas</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSub} />
                  </TouchableOpacity>
                </>
              ) : (
                /* --- LAYOUT 2: MODO BUSINESS (TPV + Gráfico Real) --- */
                <>
                  {/* BANNER EXCLUSIVO EMPLEADO */}
                  {currentUser.role === 'employee' && (
                    <View style={{ 
                      backgroundColor: 'rgba(5, 150, 105, 0.08)', 
                      padding: 16, 
                      borderRadius: 20, 
                      borderColor: 'rgba(5, 150, 105, 0.3)', 
                      borderWidth: 1, 
                      marginBottom: 24, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                       {/* Zona Izquierda (Flex 1 evita que empuje al botón fuera) */}
                       <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(5, 150, 105, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                             <Ionicons name="lock-open" size={22} color="#059669" />
                          </View>
                          <View style={{ flex: 1 }}>
                             <Text style={{ color: '#059669', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }} numberOfLines={1} adjustsFontSizeToFit>TERMINAL DESBLOQUEADO</Text>
                             <Text style={{ color: theme.textMain, fontWeight: 'bold', fontSize: 14, marginTop: 2 }} numberOfLines={1}>Cajero: {currentUser.name}</Text>
                          </View>
                       </View>

                       {/* Botón Derecha */}
                       <TouchableOpacity
                         style={{ 
                           backgroundColor: '#059669', 
                           paddingHorizontal: 16, 
                           paddingVertical: 12, 
                           borderRadius: 14, 
                           shadowColor: '#059669', 
                           shadowOffset: { width: 0, height: 4 }, 
                           shadowOpacity: 0.25, 
                           shadowRadius: 8 
                         }}
                         activeOpacity={0.8}
                         onPress={() => {
                            if(isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setShowGatekeeper(true); // Levanta el Gatekeeper para bloquear
                            setGatekeeperPin('');
                         }}
                       >
                         <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }}>BLOQUEAR</Text>
                       </TouchableOpacity>
                    </View>
                  )}
                  {/* --- GRÁFICOS (SÓLO ADMIN) --- */}
                  {currentUser.role === 'admin' && (
                    <>

                  {/* --- BANDEJA DE AUDITORÍA (Notificación de cierres de empleados) --- */}
                      {pendingReports.length > 0 && (
                        <TouchableOpacity 
                           style={{ backgroundColor: 'rgba(249, 115, 22, 0.08)', padding: 16, borderRadius: 20, borderColor: 'rgba(249, 115, 22, 0.3)', borderWidth: 1, marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                           activeOpacity={0.8}
                           onPress={() => {
                               if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                               
                               // Extraemos el reporte más antiguo
                               const report = pendingReports[0];
                               const absDiff = Math.abs(report.difference);
                               const isSurplus = report.difference > 0;
                               const currencySymbol = CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€';
                               
                               // Construimos el Ticket de Auditoría
                               let auditTrail = report.log && report.log.length > 0
                                 ? '\n\n📝 REGISTRO DE OPERACIONES:\n' + report.log.map(op => `• ${op.time} | ${op.user} | ${op.type === 'sale' ? '+' : '-'}${op.amount}${currencySymbol}`).join('\n')
                                 : '\n\n📝 REGISTRO: No hubo ventas ni pagos.';

                               let alertMsg = `Apertura por: ${report.openedBy || 'Desconocido'}\nCierre por: ${report.employeeName} a las ${report.time}\n`;

                               alertMsg += report.difference === 0 
                                 ? `\nCaja Cuadrada a la perfección.` 
                                 : `\n⚠️ Se ha detectado un ${isSurplus ? 'SOBRANTE' : 'FALTANTE'} de ${absDiff.toFixed(2)}${currencySymbol}.\n\nCaja Teórica: ${report.theoretical} ${currencySymbol}\nCaja Real Contada: ${report.actual} ${currencySymbol}`;

                               alertMsg += auditTrail; // Pegamos el ticket al final

                               // Mostramos el reporte destapado al Jefe
                               setCustomAlert({
                                   visible: true,
                                   title: report.difference === 0 ? 'CIERRE PERFECTO' : (isSurplus ? 'SOBRANTE DE EMPLEADO' : 'FALTANTE DE EMPLEADO'),
                                   message: alertMsg,
                                   type: report.difference === 0 ? 'success' : 'error'
                               });

                               // Marcamos como "Leído" (lo borramos de la bandeja pendiente)
                               setPendingReports(prev => prev.slice(1));
                           }}
                        >
                           <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                              <View style={{width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(249, 115, 22, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12}}>
                                 <Ionicons name="notifications" size={22} color="#F97316" />
                              </View>
                              <View style={{ flex: 1 }}>
                                 <Text style={{color: '#F97316', fontWeight: '900', fontSize: 12, letterSpacing: 0.5}}>REPORTE PENDIENTE ({pendingReports.length})</Text>
                                 <Text style={{color: theme.textMain, fontWeight: 'bold', fontSize: 14, marginTop: 2}} numberOfLines={1}>Turno de {pendingReports[0].employeeName}</Text>
                              </View>
                           </View>
                           <Ionicons name="chevron-forward" size={24} color="#F97316" />
                        </TouchableOpacity>
                      )}

                      {/* --- TÍTULO CON PUNTOS NATIVOS DE PAGINACIÓN --- */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
                    <Text style={{color: theme.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1}}>RENDIMIENTO FINANCIERO</Text>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeChartIndex === 0 ? theme.accent : 'rgba(216,216,218,0.2)', marginHorizontal: 3 }} />
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeChartIndex === 1 ? theme.accent : 'rgba(216,216,218,0.2)', marginHorizontal: 3 }} />
                    </View>
                  </View>
                  
                  <View style={{ width: Dimensions.get('window').width - 48, marginBottom: 24, alignSelf: 'center' }}>
                    <ScrollView 
                      horizontal 
                      pagingEnabled 
                      showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={(e) => {
                        // Magia UX: Sincroniza los puntitos del título al terminar de deslizar
                        const slideSize = Dimensions.get('window').width - 48;
                        setActiveChartIndex(Math.round(e.nativeEvent.contentOffset.x / slideSize));
                      }}
                    >
                      
                      {/* --- SLIDE 1: GRÁFICO PRINCIPAL (MOTOR MATEMÁTICO REAL) --- */}
                      <View style={{ width: Dimensions.get('window').width - 48 }}>
                        {(() => {
                          const chartCurrency = CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€';
                          const isWeek = businessChartTimeframe === 'week';
                          let labels = isWeek ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['S1', 'S2', 'S3', 'S4'];
                          let data = labels.map(() => ({ in: 0, out: 0 }));

                          // Algoritmo de extracción de datos del Historial
                          activeDeposits.forEach(dep => {
                              if (!dep.history) return;
                              dep.history.forEach(mov => {
                                  const [datePart] = (mov.date || '').split(' - ');
                                  const [d, m, y] = (datePart || '').split('/');
                                  if (!d || !m || !y) return;
                                  const movDate = new Date(`${y}-${m}-${d}`);
                                  const now = new Date();

                                  if (!isWeek) { 
                                      // Agrupación por Semanas del Mes Actual
                                      if (movDate.getMonth() === now.getMonth() && movDate.getFullYear() === now.getFullYear()) {
                                          const weekIndex = Math.min(Math.floor((movDate.getDate() - 1) / 8), 3);
                                          if (mov.type === 'in') data[weekIndex].in += mov.amount;
                                          if (mov.type === 'out') data[weekIndex].out += mov.amount;
                                      }
                                  } else { 
                                      // Agrupación por Días de los últimos 7 días
                                      const diffTime = Math.abs(now - movDate);
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                      if (diffDays <= 7) {
                                          let dayIndex = movDate.getDay() - 1; // 0 = Lunes
                                          if (dayIndex === -1) dayIndex = 6;   // 6 = Domingo
                                          if (mov.type === 'in') data[dayIndex].in += mov.amount;
                                          if (mov.type === 'out') data[dayIndex].out += mov.amount;
                                      }
                                  }
                              });
                          });

                          // Calculamos el valor máximo real (Mínimo 100 para evitar gráficos planos o divisiones por 0)
                          const maxVal = Math.max(...data.map(d => Math.max(d.in, d.out)), 100);

                          return (
                            <View style={{ backgroundColor: theme.cardBg, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: theme.cardBorder, height: 210 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <Text style={{color: theme.textMain, fontSize: 14, fontWeight: '800'}}>Ingresos VS Gastos</Text>
                                <TouchableOpacity 
                                  style={{ backgroundColor: theme.iconBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                                  onPress={() => {
                                    if(isHapticEnabled) Haptics.selectionAsync();
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setBusinessChartTimeframe(prev => prev === 'month' ? 'week' : 'month');
                                  }}
                                >
                                  <Text style={{color: theme.accent, fontSize: 11, fontWeight: 'bold'}}>{isWeek ? 'ESTA SEMANA' : 'ESTE MES'}</Text>
                                  <Ionicons name="swap-horizontal" size={12} color={theme.accent} style={{marginLeft: 4}} />
                                </TouchableOpacity>
                              </View>

                              {/* Lienzo del Gráfico */}
                              <View style={{ flexDirection: 'row', height: 120 }}>
                                {/* Eje Y (Dinero Real) */}
                                <View style={{ justifyContent: 'space-between', paddingRight: 8, borderRightWidth: 1, borderRightColor: theme.cardBorder, alignItems: 'flex-end', paddingVertical: 5, width: 45 }}>
                                  <Text style={{fontSize: 10, color: theme.accent, fontWeight: '900', marginBottom: 2}}>{chartCurrency}</Text>
                                  <Text style={{fontSize: 9, color: theme.textSub, fontWeight: '600'}}>{Math.round(maxVal)}</Text>
                                  <Text style={{fontSize: 9, color: theme.textSub, fontWeight: '600'}}>{Math.round(maxVal / 2)}</Text>
                                  <Text style={{fontSize: 9, color: theme.textSub, fontWeight: '600'}}>0</Text>
                                </View>
                                
                                {/* Eje X (Barras y Tiempo) */}
                                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingBottom: 15, paddingLeft: 8 }}>
                                  {data.map((col, idx) => {
                                    // Alturas relativas al máximo real
                                    const heightIn = Math.max((col.in / maxVal) * 100, 2); 
                                    const heightOut = Math.max((col.out / maxVal) * 100, 2);

                                    return (
                                      /* Flexbox corregido: alignItems: 'flex-end' ancla las barras a la línea inferior */
                                      <View key={`chart-col-${idx}`} style={{ alignItems: 'flex-end', height: '100%', justifyContent: 'center', flexDirection: 'row', width: isWeek ? 16 : 30 }}>
                                        {/* Barra Ingreso */}
                                        <View style={{ width: isWeek ? 6 : 12, height: `${heightIn}%`, backgroundColor: theme.accent, borderTopLeftRadius: 4, borderTopRightRadius: 4, marginRight: 2 }} />
                                        {/* Barra Gasto */}
                                        <View style={{ width: isWeek ? 6 : 12, height: `${heightOut}%`, backgroundColor: '#F44336', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                                        <Text style={{position: 'absolute', bottom: -15, fontSize: 9, color: theme.textSub, width: 30, textAlign: 'center', left: isWeek ? -7 : 0}}>{labels[idx]}</Text>
                                      </View>
                                    );
                                  })}
                                  <View style={{ position: 'absolute', bottom: 15, left: 0, right: 0, height: 1, backgroundColor: theme.cardBorder }} />
                                </View>
                              </View>

                            </View>
                          );
                        })()}
                      </View>

                      {/* --- SLIDE 2: HUB DE AUDITORÍA (SCROLL VERTICAL ANIDADO) --- */}
                      <View style={{ width: Dimensions.get('window').width - 48 }}>
                        <ScrollView nestedScrollEnabled={true} pagingEnabled showsVerticalScrollIndicator={false} style={{ height: 210, borderRadius: 20, overflow: 'hidden' }}>
                          
                          {/* --- AUDITORÍA A: ESCUDO FISCAL (IVA) --- */}
                          <View style={{ height: 210, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder, borderRadius: 20, padding: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <Text style={{color: theme.textMain, fontSize: 14, fontWeight: '800'}}>Escudo Fiscal (Estimación IVA)</Text>
                              <Ionicons name="shield-checkmark" size={18} color={theme.accent} />
                            </View>
                            
                            {(() => {
                              const totalBal = activeDeposits.reduce((acc, dep) => acc + (typeof dep.amount === 'string' ? parseFloat(dep.amount.replace(/,/g, '')) : (dep.amount || 0)), 0);
                              // Estimamos que el 21% del total en caja es dinero fiscal
                              const taxRate = 0.21;
                              const taxAmount = totalBal * taxRate;
                              const netAmount = totalBal - taxAmount;
                              const taxPerc = totalBal > 0 ? 21 : 0;
                              const netPerc = totalBal > 0 ? 79 : 0;
                              const currencySym = CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€';

                              return (
                                <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: 10 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                    <Text style={{ fontSize: 32, fontWeight: '900', color: theme.textMain }}>{totalBal.toFixed(2)}</Text>
                                    <Text style={{ fontSize: 16, color: theme.accent, marginLeft: 4, fontWeight: 'bold' }}>{currencySym}</Text>
                                    <Text style={{ fontSize: 12, color: theme.textSub, marginLeft: 8, fontWeight: '600' }}>Total en caja</Text>
                                  </View>

                                  {/* Barra de progreso compuesta nativa */}
                                  <View style={{ height: 16, borderRadius: 8, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(216, 216, 218, 0.05)', marginVertical: 16 }}>
                                    <View style={{ width: `${netPerc}%`, height: '100%', backgroundColor: theme.accent }} />
                                    <View style={{ width: `${taxPerc}%`, height: '100%', backgroundColor: '#F97316' }} />
                                  </View>

                                  {/* Leyenda Analítica */}
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginRight: 6 }} />
                                        <Text style={{ color: theme.textSub, fontSize: 12, fontWeight: '600' }}>Libre (Neto)</Text>
                                      </View>
                                      <Text style={{ color: theme.textMain, fontSize: 15, fontWeight: '800' }}>{netAmount.toFixed(2)} {currencySym}</Text>
                                    </View>
                                    
                                    <View style={{ alignItems: 'flex-end' }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F97316', marginRight: 6 }} />
                                        <Text style={{ color: theme.textSub, fontSize: 12, fontWeight: '600' }}>Reserva IVA</Text>
                                      </View>
                                      <Text style={{ color: theme.textMain, fontSize: 15, fontWeight: '800' }}>{taxAmount.toFixed(2)} {currencySym}</Text>
                                    </View>
                                  </View>
                                </View>
                              );
                            })()}
                          </View>
                          
                          {/* --- AUDITORÍA B: TENDENCIA DE DESCUADRES --- */}
                          <View style={{ height: 210, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder, borderRadius: 20, padding: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                              <Text style={{color: theme.textMain, fontSize: 14, fontWeight: '800'}}>Precisión de Cierres</Text>
                              <Ionicons name="analytics" size={18} color={theme.accent} />
                            </View>
                            
                            {(() => {
                              // Array pre-configurado para conectarlo a la Base de Datos en el siguiente paso.
                              const recentAudits = [
                                { day: 'L', diff: 0 },
                                { day: 'M', diff: -2.5 },
                                { day: 'X', diff: 0 },
                                { day: 'J', diff: 1.2 },
                                { day: 'V', diff: -0.5 },
                              ];
                              
                              const maxDeviation = Math.max(...recentAudits.map(a => Math.abs(a.diff)), 5); // Escala dinámica
                              const currencySym = CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€';

                              return (
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 100 }}>
                                    
                                    {/* Eje Y (Desviación Bi-direccional) */}
                                    <View style={{ justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 8, borderRightWidth: 1, borderRightColor: theme.cardBorder, height: '100%', paddingVertical: 2, width: 45 }}>
                                      <Text style={{ fontSize: 9, color: '#4CAF50', fontWeight: 'bold' }}>+{Math.round(maxDeviation)}{currencySym}</Text>
                                      <Text style={{ fontSize: 9, color: theme.textSub, fontWeight: 'bold' }}>0</Text>
                                      <Text style={{ fontSize: 9, color: '#F44336', fontWeight: 'bold' }}>-{Math.round(maxDeviation)}{currencySym}</Text>
                                    </View>

                                    {/* Gráfico Bi-direccional (Puro Flexbox Nativo) */}
                                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: '100%', paddingLeft: 8 }}>
                                      {/* Línea Central (El Cero Perfecto) */}
                                      <View style={{ position: 'absolute', top: '50%', left: 8, right: 0, height: 1, backgroundColor: 'rgba(216, 216, 218, 0.2)', zIndex: -1 }} />
                                      
                                      {recentAudits.map((audit, idx) => {
                                        const heightPerc = Math.max((Math.abs(audit.diff) / maxDeviation) * 50, 2); // 50% es el máximo de cada mitad
                                        const isPositive = audit.diff >= 0;
                                        const isPerfect = audit.diff === 0;

                                        return (
                                          <View key={`audit-${idx}`} style={{ height: '100%', width: 20, alignItems: 'center' }}>
                                            
                                            {/* Mitad Superior (Sobrantes en verde) */}
                                            <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%', alignItems: 'center', paddingBottom: 1 }}>
                                              {isPositive && !isPerfect && <View style={{ width: 8, height: `${heightPerc * 2}%`, backgroundColor: '#4CAF50', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />}
                                            </View>
                                            
                                            {/* Punto central (Efecto cuando el cierre es perfecto = 0) */}
                                            {isPerfect && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent, position: 'absolute', top: '50%', marginTop: -3 }} />}

                                            {/* Mitad Inferior (Faltantes en rojo) */}
                                            <View style={{ flex: 1, justifyContent: 'flex-start', width: '100%', alignItems: 'center', paddingTop: 1 }}>
                                              {!isPositive && <View style={{ width: 8, height: `${heightPerc * 2}%`, backgroundColor: '#F44336', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} />}
                                            </View>

                                            <Text style={{ position: 'absolute', bottom: -20, fontSize: 9, color: theme.textSub, fontWeight: 'bold' }}>{audit.day}</Text>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  </View>
                                </View>
                              );
                            })()}
                          </View>

                        </ScrollView>
                        
                        {/* Indicadores Táctiles Nativos (Puntitos) */}
                        <View style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.accent, marginBottom: 4 }} />
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(216,216,218,0.2)', marginBottom: 4 }} />
                        </View>
                      </View>

                    </ScrollView>
                  </View>
                  </>
                 )}

                  <Text style={{color: theme.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12}}>PANEL DE CONTROL TPV</Text>
                  
                  {/* --- LA CÁPSULA TPV --- */}
                  <View style={{ backgroundColor: theme.cardBg, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.cardBorder, marginBottom: 24 }}>
                    
                    {/* Botón Maestro (Abrir / Cerrar) */}
                    {isRegisterOpen && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 8 }} />
                        <Text style={{ color: theme.textSub, fontSize: 12, fontWeight: '700' }}>
                          Caja abierta desde las {registerOpenTime}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity 
                      style={{
                        backgroundColor: isRegisterOpen ? 'rgba(244, 67, 54, 0.1)' : theme.accent, 
                        borderRadius: 20, padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
                        borderWidth: isRegisterOpen ? 1 : 0, borderColor: isRegisterOpen ? '#F44336' : 'transparent',
                        shadowColor: isRegisterOpen ? 'transparent' : theme.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, 
                        marginBottom: 20
                      }}
                      activeOpacity={0.9}
                      onPress={() => {
                        if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        
                        if (!isRegisterOpen) {
                          setRegisterStep(1);
                          setRegisterBaseNotes({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 });
                          setRegisterSales(0);
                          setRegisterExpenses(0);
                          setCurrentScreen('CashRegisterClose');
                        } else {
                          setRegisterStep(3);
                          setRegisterCountedNotes({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 });
                          setCurrentScreen('CashRegisterClose');
                        }
                      }}
                    >
                      <Ionicons name="calculator" size={28} color={isRegisterOpen ? "#F44336" : "#0F172A"} style={{marginRight: 12}} />
                      <Text style={{color: isRegisterOpen ? '#F44336' : '#0F172A', fontSize: 18, fontWeight: '900', letterSpacing: 1}}>
                        {isRegisterOpen ? 'REALIZAR CIERRE' : 'ABRIR CAJA'}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: theme.cardBorder, marginBottom: 20, marginHorizontal: 10 }} />

                    {/* Botones de Operación Rápida (Reaccionan al estado de la caja) */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <TouchableOpacity 
                        style={{width: '48%', backgroundColor: theme.bg, borderColor: theme.cardBorder, borderWidth: 1, borderRadius: 16, padding: 16, alignItems: 'center', opacity: isRegisterOpen ? 1 : 0.4}}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!isRegisterOpen) {
                            if(isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            setCustomAlert({ visible: true, title: 'CAJA CERRADA', message: 'Abre la caja primero para poder cobrar.', type: 'error' });
                            return;
                          }
                          if(isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setQuickActionType('sale');
                          setQuickActionAmount('');
                          setIsQuickActionVisible(true);
                        }}
                      >
                        <View style={{width: 44, height: 44, borderRadius: 22, backgroundColor: isRegisterOpen ? 'rgba(76, 175, 80, 0.15)' : theme.iconBg, justifyContent: 'center', alignItems: 'center', marginBottom: 12}}>
                          <Ionicons name="arrow-up" size={24} color={isRegisterOpen ? "#4CAF50" : theme.textSub} />
                        </View>
                        <Text style={{color: theme.textMain, fontWeight: '800', fontSize: 14}}>Nueva venta</Text>
                        <Text style={{color: theme.textSub, fontSize: 10, marginTop: 4}}>Cobro en efectivo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{width: '48%', backgroundColor: theme.bg, borderColor: theme.cardBorder, borderWidth: 1, borderRadius: 16, padding: 16, alignItems: 'center', opacity: isRegisterOpen ? 1 : 0.4}}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!isRegisterOpen) {
                            if(isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            setCustomAlert({ visible: true, title: 'CAJA CERRADA', message: 'Abre la caja primero para pagar a proveedores.', type: 'error' });
                            return;
                          }
                          if(isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setQuickActionType('expense');
                          setQuickActionAmount('');
                          setIsQuickActionVisible(true);
                        }}
                      >
                        <View style={{width: 44, height: 44, borderRadius: 22, backgroundColor: isRegisterOpen ? 'rgba(244, 67, 54, 0.15)' : theme.iconBg, justifyContent: 'center', alignItems: 'center', marginBottom: 12}}>
                          <Ionicons name="arrow-down" size={24} color={isRegisterOpen ? "#F44336" : theme.textSub} />
                        </View>
                        <Text style={{color: theme.textMain, fontWeight: '800', fontSize: 14}}>Pago / Gasto</Text>
                        <Text style={{color: theme.textSub, fontSize: 10, marginTop: 4}}>Salida de dinero</Text>
                      </TouchableOpacity>
                    </View>

                  </View>

                  {/* --- GESTIÓN DEL NEGOCIO (SÓLO ADMIN) --- */}
                  {currentUser.role === 'admin' && (
                    <>
                      <Text style={{color: theme.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12}}>GESTIÓN DEL NEGOCIO</Text>
                      
                      {/* --- BOTONES SECUNDARIOS --- */}
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30}}>
                    <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentScreen('DepositsList'); }} style={{width: '48%', backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, borderRadius: 20, padding: 16, alignItems: 'center'}}>
                      <View style={{width: 44, height: 44, borderRadius: 22, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginBottom: 12}}>
                        <Ionicons name="layers-outline" size={24} color={theme.accent} />
                      </View>
                      <Text style={{color: theme.textMain, fontWeight: '800', fontSize: 14}}>Mis Cajas</Text>
                      <Text style={{color: theme.textSub, fontSize: 10, marginTop: 4}}>Gestionar bóvedas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={{width: '48%', backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, borderRadius: 20, padding: 16, alignItems: 'center'}}
                      activeOpacity={0.8}
                      onPress={() => {
                        if(isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTeamSetupStep(teamMode ? (teamMode === 'local' ? 'local_setup' : 'cloud_setup') : 'decision');
                        setShowTeamOnboarding(true);
                      }}
                    >
                      <View style={{width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(33, 150, 243, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12}}>
                        <Ionicons name="people" size={24} color="#2196F3" />
                      </View>
                      <Text style={{color: theme.textMain, fontWeight: '800', fontSize: 14}}>Plantilla y roles</Text>
                      <Text style={{color: theme.textSub, fontSize: 10, marginTop: 4}}>Acceso empleados</Text>
                    </TouchableOpacity>
                  </View>
                    </>
                  )}
                </>
              )}

            </ScrollView>

            {/* BOTÓN DE MEJORAR PLAN FLOTANTE (Tematizado) */}
            <View style={[styles.dashBottom, { backgroundColor: theme.bg }]}>
              <TouchableOpacity style={[styles.upgradeBtn, { backgroundColor: theme.accent, shadowColor: theme.accent }]} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentScreen('Plans'); }} activeOpacity={0.9}>
                <View style={styles.upgradeBtnInner}>
                  <View style={[styles.upgradeIconBox, { backgroundColor: theme.bg }]}>
                   <FontAwesome5 name="crown" size={15} color={theme.accent} />
                  </View>
                  <View style={styles.upgradeTextCol}>
                    <Text style={[styles.upgradeBtnText, { color: theme.bg }]}>MEJORAR PLAN</Text>
                    <Text style={[styles.upgradeBtnSub, { color: theme.bg, opacity: 0.7 }]}>Beneficios exclusivos sin límites</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <Text style={styles.slogan}>Gestiona tu efectivo, gestiona tu libertad</Text>
            </View>

          </View>
        )}

        {/* PANTALLA 1A: MIS DEPÓSITOS */}
        {currentScreen === 'DepositsList' && (
          <View style={styles.depositsContainer}>
            <View style={styles.depositsHeaderRow}>
              <TouchableOpacity 
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCurrentScreen('Dashboard');
                }} 
                style={[styles.backArrowBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="chevron-back" size={22} color={theme.textMain} style={{ marginLeft: -2 }} />
              </TouchableOpacity>
              <Text style={[styles.depositsTitle, { color: theme.textMain }]}>MIS DEPÓSITOS</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.depositsListScroll}>
              {activeDeposits.length === 0 ? (
                <View style={{alignItems: 'center', marginTop: 60}}>
                  <Ionicons name="shield-half-outline" size={60} color={theme.textSub} style={{marginBottom: 16}} />
                  <Text style={{color: theme.textMain, fontSize: 18, fontWeight: '700', marginBottom: 8}}>Sin bóvedas activas</Text>
                  <Text style={{color: theme.textSub, fontSize: 14, textAlign: 'center', paddingHorizontal: 20}}>
                    {appMode === 'business' ? 'Crea tu primera caja de negocio.' : 'Crea tu primer depósito personal.'}
                  </Text>
                </View>
              ) : (
                activeDeposits.map((deposit) => {
                  const currency = CURRENCIES.find(c => c.id === deposit.currencyId);
                  return (
                    <View key={deposit.id}>
                    <Swipeable 
                      overshootRight={false}
                      renderRightActions={() => (
                        <TouchableOpacity 
                          style={styles.deleteSwipeBtn}
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setDeposits(prev => prev.filter(d => d.id !== deposit.id));
                            if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                          }}
                        >
                          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}
                    >
                      <TouchableOpacity 
                        activeOpacity={1} 
                        onPress={() => {
                          setActiveDeposit({
                            ...deposit,
                            amount: typeof deposit.amount === 'string' ? parseFloat(deposit.amount.replace(/,/g, '')) : deposit.amount,
                            banknotes: deposit.banknotes || { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 },
                            history: deposit.history || []
                          });
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setCurrentScreen('DepositDetail');
                        }}
                        style={[styles.depositCard, { marginBottom: 0, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                      >
                        <View style={styles.depositCardLeft}>
                          <View style={[styles.depositIconCircle, { backgroundColor: theme.iconBg }]}>
                            <Ionicons name="wallet" size={18} color={theme.accent} />
                          </View>
                          <Text style={[styles.depositName, { color: theme.textMain }]} numberOfLines={1}>{deposit.name || 'Depósito sin nombre'}</Text>
                        </View>
                        <Text style={[styles.depositBalance, { color: theme.accent }]}>
                          <Odometer value={typeof deposit.amount === 'string' ? parseFloat(deposit.amount.replace(/,/g, '')) : deposit.amount} /> {currency?.symbol || deposit.currencyId}
                        </Text>
                      </TouchableOpacity>
                    </Swipeable>
          <View style={{ height: 14 }} /> {/* Separador visual */}
        </View>
        );
                })
              )}
            </ScrollView>

            <View style={[styles.bottomBarDeposits, { backgroundColor: appMode === 'business' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(17, 26, 66, 0.95)', borderTopColor: theme.cardBorder }]}>
              <TouchableOpacity 
                style={[styles.createDepositButton, { backgroundColor: theme.accent, shadowColor: theme.accent }]} 
                onPress={() => {
                  if (userPlan === 'basic' && deposits.length >= 2) {
                    if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setCustomAlert({ 
                      visible: true, 
                      title: 'LÍMITE ALCANZADO', 
                      message: 'El Plan Básico permite un máximo de 2 bóvedas.\nMejora tu plan a Premium para obtener depósitos ilimitados.', 
                      type: 'error' 
                    });
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setCurrentScreen('Plans');
                  } else {
                    setIsCreateDepositModalVisible(true);
                  }                
                }}
                activeOpacity={0.9}
              >
                <Text style={[styles.createDepositButtonText, { color: theme.bg }]}>CREAR DEPÓSITO</Text>
                <Ionicons name="add" size={20} color={theme.bg} style={{marginLeft: 8}} />
              </TouchableOpacity>
            </View>
  </View>
)}

{/* PANTALLA 2A: DETALLE / EDICIÓN DE DEPÓSITO */}
        {currentScreen === 'DepositDetail' && (
          <View style={styles.detailContainer}>
            <TouchableOpacity 
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setCurrentScreen('DepositsList');
              }} 
              style={[styles.backArrowBtn, { marginHorizontal: 24, marginTop: 16, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
            >
              <Ionicons name="chevron-back" size={22} color={theme.textMain} style={{ marginLeft: -2 }} />
            </TouchableOpacity>

            <View style={styles.detailTitleWrapper}>
              <TextInput 
                style={[styles.detailTitleInput, { color: theme.textMain }, activeDeposit.name === '' && { fontStyle: 'italic', fontWeight: '500' }]} 
                value={activeDeposit.name} 
                onChangeText={(text) => {
                  setActiveDeposit({ ...activeDeposit, name: text });
                  setDeposits(prev => prev.map(d => d.id === activeDeposit.id ? { ...d, name: text } : d));
                }}
                placeholder="Nombre del depósito"
                placeholderTextColor={theme.textSub}
              />
              <View style={[styles.titleUnderline, { backgroundColor: theme.accent }]} />
            </View>

            <View style={styles.balanceSection}>
              <Text style={styles.balanceMiniLabel}>SALDO</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={[styles.balanceBigAmount, { color: theme.textMain }]}>
                  {activeDeposit.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}{' '}
                </Text>
                <TouchableOpacity 
                  onPress={() => {
                    if (selectedCurrencies.length <= 1) return;
                    const currentIndex = selectedCurrencies.indexOf(activeDeposit.currencyId);
                    const nextIndex = (currentIndex + 1) % selectedCurrencies.length;
                    const newCurrency = selectedCurrencies[nextIndex];
                    
                    const updatedDeposit = { ...activeDeposit, currencyId: newCurrency };
                    setActiveDeposit(updatedDeposit);
                    setDeposits(prev => prev.map(d => d.id === updatedDeposit.id ? updatedDeposit : d));
                    if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={[styles.balanceCurrency, { color: theme.accent }]}>{CURRENCIES.find(c => c.id === activeDeposit.currencyId)?.symbol}</Text>
                  {selectedCurrencies.length > 1 && (
                    <Ionicons name="sync-outline" size={22} color={theme.accent} style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* --- SECCIÓN PREMIUM: BÓVEDA COMPARTIDA --- */}
            <View style={{ paddingHorizontal: 24, marginBottom: 28 }}>
              <Text style={[styles.notesSectionTitle, { marginBottom: 12 }]}>MIEMBROS DE LA BÓVEDA</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingRight: 20 }}>
                
                {/* 1. Botón Invitar Miembro */}
                <TouchableOpacity 
                  style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.iconBg, borderWidth: 1.5, borderColor: theme.cardBorder, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderStyle: 'dashed' }}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (userPlan === 'basic') {
                      if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      setCustomAlert({ 
                        visible: true, 
                        title: 'BÓVEDAS COMPARTIDAS', 
                        message: 'Comparte el control de esta bóveda con tu familia o socios de negocio en tiempo real.\n\nMejora tu plan para invitar usuarios.', 
                        type: 'error' 
                      });
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setCurrentScreen('Plans');
                    } else {
                      if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      Alert.alert("Invitar miembro", "Generando enlace encriptado seguro...\nPodrás enviarlo por WhatsApp o Email.");
                    }
                  }}
                >
                  <Ionicons name="person-add" size={20} color={theme.accent} style={{marginLeft: 2}} />
                </TouchableOpacity>

                {/* 2. Tú (El Propietario) */}
                <View style={{ position: 'relative', marginRight: 14 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.textMain, fontSize: 16, fontWeight: '700' }}>{finalUserName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: theme.bg }} />
                </View>

              </ScrollView>
            </View>

            <View style={styles.notesSection}>
              <Text style={styles.notesSectionTitle}>Nº DE BILLETES POR DENOMINACIÓN</Text>
              <View style={styles.notesGrid}>
                {Object.values(activeDeposit.banknotes).every(count => count === 0) ? (
                  <View style={[styles.emptyStateBox, {width: '100%', backgroundColor: theme.cardBg, borderColor: theme.cardBorder}]}>
                    <Ionicons name="wallet-outline" size={32} color={theme.textSub} />
                    <Text style={[styles.emptyStateText, { color: theme.textSub }]}>Bóveda vacía. Realiza tu primer ingreso.</Text>
                  </View>
                ) : (
                  Object.entries(activeDeposit.banknotes)
                    .sort(([a], [b]) => Number(b) - Number(a)) 
                    .filter(([_, count]) => count > 0) 
                    .map(([denomination, count]) => (
                      <View key={`note-${denomination}`} style={[styles.notePill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <Text style={[styles.noteMultiplier, { color: theme.textMain }]}>{count}x</Text>
                        {activeDeposit.currencyId === 'EUR' && EURO_IMAGES[denomination] ? (
                          <Image source={EURO_IMAGES[denomination]} style={styles.noteImageBig} />
                        ) : (
                          <View style={[styles.noteFallback, { backgroundColor: theme.iconBg }]}><Text style={[styles.noteFallbackText, { color: theme.accent }]}>{denomination}</Text></View>
                        )}
                      </View>
                  ))
                )}
              </View>
            </View>

          
            <View style={styles.historyHeader}>
              <Text style={styles.historySectionTitle}>HISTORIAL DE MOVIMIENTOS</Text>
              <View style={[styles.historyDivider, { backgroundColor: theme.cardBorder }]} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyScroll}>
              {(!activeDeposit.history || activeDeposit.history.length === 0) ? (
                <View style={[styles.emptyStateBox, { marginTop: 10, paddingVertical: 40, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                  <Ionicons name="document-text-outline" size={32} color={theme.textSub} style={{marginBottom: 8}} />
                  <Text style={[styles.emptyStateText, { color: theme.textSub }]}>Aún no hay movimientos registrados.</Text>
                </View>
              ) : (
                activeDeposit.history.map((mov) => (
                  <View key={mov.id} style={[styles.historyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <View style={styles.historyLeft}>
                      <View style={[styles.historyIconBox, mov.type === 'in' ? styles.historyIn : styles.historyOut]}>
                        <Ionicons name={mov.type === 'in' ? "arrow-up" : "arrow-down"} size={16} color={mov.type === 'in' ? "#4CAF50" : "#F44336"} />
                      </View>
                      <View>
                        {mov.concept ? <Text style={[styles.historyConcept, { color: theme.textMain }]} numberOfLines={1}>{mov.concept}</Text> : null}
                        <Text style={[styles.historyAmount, { color: mov.type === 'in' ? "#4CAF50" : "#F44336" }]}>
                          {mov.type === 'in' ? '+' : '-'}{mov.amount.toLocaleString('en-US', {minimumFractionDigits: 2})} {CURRENCIES.find(c => c.id === activeDeposit.currencyId)?.symbol}
                        </Text>
                        <Text style={[styles.historyBalanceAfter, { color: theme.textSub }]}>Saldo: {mov.balanceAfter.toLocaleString('en-US', {minimumFractionDigits: 2})}</Text>
                        {mov.date && <Text style={[styles.historyDate, { color: theme.textSub }]}>{mov.date}</Text>}
                      </View>
                    </View>
                    <View style={styles.historyNotesCol}>
                      {Object.entries(mov.notes).map(([denom, count]) => (
                        <View key={`hist-${denom}`} style={styles.historyMiniNoteRow}>
                          <Text style={[styles.historyMiniNoteText, { color: theme.textSub }]}>{mov.type === 'in' ? '+' : '-'}{count}x</Text>
                          {activeDeposit.currencyId === 'EUR' && EURO_IMAGES[denom] && (
                            <Image source={EURO_IMAGES[denom]} style={styles.noteImageMini} />
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.bottomBarDeposits, { backgroundColor: appMode === 'business' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(17, 26, 66, 0.95)', borderTopColor: theme.cardBorder }]}>
              <TouchableOpacity 
                style={[styles.createDepositButton, { backgroundColor: theme.accent, shadowColor: theme.accent }]} 
                onPress={() => {
                  setOperationType('in');
                  setOperationNotes({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 });
                  setOperationConcept('');
                  setIsModalVisible(true);
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="swap-vertical" size={20} color={theme.bg} style={{marginRight: 8}} />
                <Text style={[styles.createDepositButtonText, { color: theme.bg }]}>INGRESAR / RETIRAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
{/* --- PANTALLA EXCLUSIVA BUSINESS: CIERRE DE CAJA --- */}
        {currentScreen === 'CashRegisterClose' && (
          <View style={{ flex: 1, width: '100%', backgroundColor: theme.bg, paddingTop: Platform.OS === 'android' ? 20 : 0 }}>
            
            {/* Cabecera TPV de Alta Gama */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 24, marginBottom: 20, width: '100%' }}>
              <TouchableOpacity 
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCurrentScreen('Dashboard');
                }} 
                style={[styles.settingsBackBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="close" size={24} color={theme.textMain} style={{ marginLeft: -2 }} />
              </TouchableOpacity>
              <View style={{alignItems: 'center'}}>
                <Text style={[styles.settingsMainTitle, { color: theme.textMain }]}>CIERRE DE CAJA</Text>
                <Text style={{color: theme.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1}}>ASISTENTE CONTABLE</Text>
              </View>
              <View style={styles.settingsHeaderSpacer} />
            </View>

            <ScrollView 
              style={{ flex: 1, width: '100%' }} 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60, paddingTop: 10 }}
            >
              
              {/* --- FASE 1: APERTURA (FONDO DE CAJA) --- */}
              {registerStep === 1 && (() => {
                const totalBase = [500, 200, 100, 50, 20, 10, 5].reduce((sum, denom) => sum + (denom * registerBaseNotes[denom]), 0);
                const hasBaseMoney = totalBase > 0;
                
                return (
                  <View style={{ width: '100%', alignItems: 'center', marginTop: 20 }}>
                    
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                      <Ionicons name="sunny" size={32} color={theme.accent} />
                    </View>
                    
                    <Text style={{ color: theme.textSub, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }}>PASO 1: APERTURA</Text>
                    <Text style={{ color: theme.textMain, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Fondo de Caja Inicial</Text>
                    <Text style={{ color: theme.textSub, fontSize: 14, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20, lineHeight: 20 }}>
                      Indica el desglose exacto de los billetes con los que abres la caja hoy (cambio disponible).
                    </Text>

                    {/* Resumen Inmersivo (Calculado en tiempo real) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: hasBaseMoney ? 'rgba(5, 150, 105, 0.1)' : theme.cardBg, borderWidth: 1, borderColor: hasBaseMoney ? theme.accent : theme.cardBorder, borderRadius: 24, height: 90, width: '100%', marginBottom: 30, shadowColor: hasBaseMoney ? theme.accent : 'transparent', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 10 }}>
                      <Text style={{ color: hasBaseMoney ? theme.accent : theme.textSub, fontSize: 44, fontWeight: '900' }}>
                        {totalBase.toFixed(2)} <Text style={{ fontSize: 30 }}>{CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€'}</Text>
                      </Text>
                    </View>

                    {/* Contadores de Billetes (Fondo de Caja) */}
                    <View style={{ width: '100%', marginBottom: 30 }}>
                      {[500, 200, 100, 50, 20, 10, 5].map((denom) => {
                        const count = registerBaseNotes[denom];
                        const currentCurrencyId = activeDeposits[0]?.currencyId || 'EUR';
                        const currentSymbol = CURRENCIES.find(c => c.id === currentCurrencyId)?.symbol || '€';
                        
                        return (
                          <View key={`base-calc-${denom}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.cardBg, borderWidth: 1, borderColor: count > 0 ? theme.accent : theme.cardBorder, borderRadius: 16, padding: 12, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {currentCurrencyId === 'EUR' && EURO_IMAGES[denom] ? (
                                <Image source={EURO_IMAGES[denom]} style={{ width: 50, height: 28, resizeMode: 'contain', borderRadius: 4, marginRight: 12 }} />
                              ) : (
                                <View style={{ width: 50, height: 28, backgroundColor: theme.iconBg, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>{denom}</Text>
                                </View>
                              )}
                              <Text style={{ color: count > 0 ? theme.accent : theme.textMain, fontSize: 16, fontWeight: '600' }}>{denom} {currentSymbol}</Text>
                            </View>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(17, 26, 66, 0.3)', borderRadius: 12, padding: 4 }}>
                              <TouchableOpacity 
                                style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: count > 0 ? theme.iconBg : 'transparent', borderRadius: 8 }}
                                onPress={() => {
                                  if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  if (count > 0) setRegisterBaseNotes(prev => ({ ...prev, [denom]: count - 1 }));
                                }}
                              >
                                <Ionicons name="remove" size={20} color={count > 0 ? theme.accent : theme.textSub} />
                              </TouchableOpacity>
                              <Text style={{ width: 30, textAlign: 'center', color: theme.textMain, fontSize: 16, fontWeight: '700' }}>{count}</Text>
                              <TouchableOpacity 
                                style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.iconBg, borderRadius: 8 }}
                                onPress={() => {
                                  if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setRegisterBaseNotes(prev => ({ ...prev, [denom]: count + 1 }));
                                }}
                              >
                                <Ionicons name="add" size={20} color={theme.accent} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Botón de Confirmar Apertura */}
                    <TouchableOpacity 
                      style={{ 
                        width: '100%', 
                        backgroundColor: hasBaseMoney ? theme.accent : theme.cardBg, 
                        borderRadius: 16, 
                        height: 56, 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        borderWidth: hasBaseMoney ? 0 : 1,
                        borderColor: theme.cardBorder,
                        marginBottom: 20
                      }}
                      activeOpacity={0.8}
                      disabled={!hasBaseMoney}
                      onPress={() => {
                        if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        
                        // Guardamos la hora de apertura, quién la abre y reseteamos el libro
                        const now = new Date();
                        setRegisterOpenTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
                        setRegisterOpenedBy(currentUser.name);
                        setRegisterLog([]); // Limpiamos el historial para el nuevo turno
                        setIsRegisterOpen(true);
                        // Volvemos al Dashboard
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setCurrentScreen('Dashboard');
                        
                        setCustomAlert({
                          visible: true,
                          title: 'TURNO INICIADO',
                          message: 'La caja está abierta. Ahora puedes registrar tus cobros y pagos desde el TPV.',
                          type: 'success'
                        });
                      }}
                    >
                      <Text style={{ color: hasBaseMoney ? theme.bg : theme.textSub, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
                        {hasBaseMoney ? 'CONFIRMAR Y ABRIR CAJA' : 'AÑADE BILLETES DE FONDO'}
                      </Text>
                    </TouchableOpacity>

                  </View>
                );
              })()}

              {/* --- FASE 2: OPERACIONES (VENTAS Y GASTOS) --- */}
              {registerStep === 2 && (
                <View style={{ width: '100%', alignItems: 'center', marginTop: 20 }}>
                  
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                    <Ionicons name="swap-vertical" size={32} color={theme.accent} />
                  </View>
                  
                  <Text style={{ color: theme.textSub, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }}>PASO 2: OPERACIONES</Text>
                  <Text style={{ color: theme.textMain, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Flujo de Caja</Text>
                  <Text style={{ color: theme.textSub, fontSize: 14, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20, lineHeight: 20 }}>
                    Introduce el total de ventas cobradas en efectivo y los pagos realizados hoy a proveedores.
                  </Text>

                  {/* Input Ventas (Ingresos) */}
                  <View style={{ width: '100%', backgroundColor: theme.cardBg, borderWidth: 1, borderColor: registerSales ? theme.accent : theme.cardBorder, borderRadius: 20, padding: 20, marginBottom: 16 }}>
                    <Text style={{ color: theme.textMain, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 12 }}>+ VENTAS EN EFECTIVO</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: theme.accent, fontSize: 28, fontWeight: '900', marginRight: 12 }}>{CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€'}</Text>
                      <TextInput
                        style={{ flex: 1, color: theme.accent, fontSize: 32, fontWeight: 'bold', outlineStyle: 'none', padding: 0, margin: 0 }}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={theme.textSub}
                        value={registerSales ? registerSales.toString() : ''}
                        onChangeText={(val) => setRegisterSales(val.replace(/[^0-9.]/g, ''))}
                        selectionColor={theme.accent}
                      />
                    </View>
                  </View>

                  {/* Input Gastos (Salidas) */}
                  <View style={{ width: '100%', backgroundColor: theme.cardBg, borderWidth: 1, borderColor: registerExpenses ? '#F44336' : theme.cardBorder, borderRadius: 20, padding: 20, marginBottom: 30 }}>
                    <Text style={{ color: theme.textMain, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 12 }}>- PAGOS Y GASTOS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: '#F44336', fontSize: 28, fontWeight: '900', marginRight: 12 }}>{CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€'}</Text>
                      <TextInput
                        style={{ flex: 1, color: '#F44336', fontSize: 32, fontWeight: 'bold', outlineStyle: 'none', padding: 0, margin: 0 }}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={theme.textSub}
                        value={registerExpenses ? registerExpenses.toString() : ''}
                        onChangeText={(val) => setRegisterExpenses(val.replace(/[^0-9.]/g, ''))}
                        selectionColor="#F44336"
                      />
                    </View>
                  </View>

                  {/* Resumen Teórico Calculado en Tiempo Real */}
                  <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(216,216,218,0.03)', padding: 16, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.05)' }}>
                     <Text style={{ color: theme.textSub, fontSize: 13, fontWeight: '600' }}>Caja Teórica Esperada:</Text>
                     <Text style={{ color: theme.textMain, fontSize: 18, fontWeight: '800' }}>
                        {(([500, 200, 100, 50, 20, 10, 5].reduce((sum, denom) => sum + (denom * registerBaseNotes[denom]), 0) + parseFloat(registerSales || 0) - parseFloat(registerExpenses || 0)).toFixed(2))} {CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€'}
                     </Text>
                  </View>

                  {/* Botones de Navegación */}
                  <View style={{ width: '100%', flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, backgroundColor: 'transparent', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.cardBorder }}
                      activeOpacity={0.8}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setRegisterStep(1);
                      }}
                    >
                      <Text style={{ color: theme.textSub, fontSize: 14, fontWeight: '700' }}>ATRÁS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={{ flex: 2, backgroundColor: theme.accent, borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', shadowColor: theme.accent, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8 }}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setRegisterStep(3);
                      }}
                    >
                      <Text style={{ color: theme.bg, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }}>IR AL CUADRE</Text>
                    </TouchableOpacity>
                  </View>

                </View>
              )}

              {/* --- FASE 3: EL CUADRE REAL (CONTEO DE BILLETES) --- */}
              {registerStep === 3 && (() => {
                // Motor Matemático en Tiempo Real encapsulado
                const baseTotal = [500, 200, 100, 50, 20, 10, 5].reduce((sum, denom) => sum + (denom * registerBaseNotes[denom]), 0);
                const actualTotal = [500, 200, 100, 50, 20, 10, 5].reduce((sum, denom) => sum + (denom * registerCountedNotes[denom]), 0);
                const theoreticalTotal = (baseTotal + parseFloat(registerSales || 0) - parseFloat(registerExpenses || 0));
                const difference = actualTotal - theoreticalTotal;
                
                return (
                  <View style={{ width: '100%', alignItems: 'center', marginTop: 20 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                      <Ionicons name="cash-outline" size={32} color={theme.accent} />
                    </View>
                    
                    <Text style={{ color: theme.textSub, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }}>PASO 3: CUADRE FINAL</Text>
                    <Text style={{ color: theme.textMain, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Conteo de caja</Text>
                    <Text style={{ color: theme.textSub, fontSize: 14, textAlign: 'center', marginBottom: 30, paddingHorizontal: 10, lineHeight: 20 }}>
                      Cuenta el dinero físico real que hay en el cajón e introdúcelo.
                    </Text>

                    {/* Panel de Cierre Inteligente o Cierre Ciego */}
                    {currentUser.role === 'admin' ? (
                      <View style={{ width: '100%', backgroundColor: difference === 0 ? 'rgba(76, 175, 80, 0.05)' : difference < 0 ? 'rgba(244, 67, 54, 0.05)' : 'rgba(33, 150, 243, 0.05)', borderWidth: 1, borderColor: difference === 0 ? '#4CAF50' : difference < 0 ? '#F44336' : '#2196F3', borderRadius: 20, padding: 20, marginBottom: 30 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                          <Text style={{ color: theme.textSub, fontSize: 14, fontWeight: '600' }}>Teórico (Esperado):</Text>
                          <Text style={{ color: theme.textMain, fontSize: 16, fontWeight: '700' }}>{theoreticalTotal.toFixed(2)} {CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                          <Text style={{ color: theme.textSub, fontSize: 14, fontWeight: '600' }}>Real (Contado):</Text>
                          <Text style={{ color: theme.textMain, fontSize: 16, fontWeight: '700' }}>{actualTotal.toFixed(2)} {CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€'}</Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: 'rgba(216, 216, 218, 0.1)', marginBottom: 16, width: '100%' }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: difference === 0 ? '#4CAF50' : difference < 0 ? '#F44336' : '#2196F3', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }}>
                            {difference === 0 ? 'CAJA CUADRADA' : difference < 0 ? 'FALTA DINERO' : 'SOBRA DINERO'}
                          </Text>
                          <Text style={{ color: difference === 0 ? '#4CAF50' : difference < 0 ? '#F44336' : '#2196F3', fontSize: 24, fontWeight: '900' }}>
                            {difference > 0 ? '+' : ''}{difference.toFixed(2)} {CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ width: '100%', backgroundColor: 'rgba(5, 150, 105, 0.05)', borderWidth: 1, borderColor: '#059669', borderRadius: 20, padding: 20, marginBottom: 30, alignItems: 'center' }}>
                         <Ionicons name="shield-checkmark" size={32} color="#059669" style={{ marginBottom: 12 }} />
                         <Text style={{ color: '#059669', fontSize: 16, fontWeight: '900', marginBottom: 8, letterSpacing: 1 }}>MODO CIERRE CIEGO</Text>
                         <Text style={{ color: theme.textMain, fontSize: 14, textAlign: 'center' }}>Cuenta los billetes físicos y envía el reporte. El cuadre final se calculará de forma oculta y se enviará al administrador.</Text>
                      </View>
                    )}

                    {/* Contadores de Billetes */}
                    <View style={{ width: '100%', marginBottom: 30 }}>
                      <Text style={{ color: theme.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 16 }}>DESGLOSE DE BILLETES</Text>
                      {[500, 200, 100, 50, 20, 10, 5].map((denom) => {
                        const count = registerCountedNotes[denom];
                        
                        // 1. Aislamos la moneda actual (con fallback seguro a EUR)
                        const currentCurrencyId = activeDeposits[0]?.currencyId || 'EUR';
                        const currentSymbol = CURRENCIES.find(c => c.id === currentCurrencyId)?.symbol || '€';
                        
                        return (
                          <View key={`reg-calc-${denom}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder, borderRadius: 16, padding: 12, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              
                              {/* 2. Condición arreglada: Mostramos imágenes SOLO si la divisa segura es EUR */}
                              {currentCurrencyId === 'EUR' && EURO_IMAGES[denom] ? (
                                <Image source={EURO_IMAGES[denom]} style={{ width: 50, height: 28, resizeMode: 'contain', borderRadius: 4, marginRight: 12 }} />
                              ) : (
                                /* Fallback Genérico para Dólares, Yenes, Libras, etc. */
                                <View style={{ width: 50, height: 28, backgroundColor: theme.iconBg, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>{denom}</Text>
                                </View>
                              )}
                              <Text style={{ color: theme.textMain, fontSize: 16, fontWeight: '600' }}>{denom} {currentSymbol}</Text>
                            </View>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(17, 26, 66, 0.3)', borderRadius: 12, padding: 4 }}>
                              <TouchableOpacity 
                                style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: count > 0 ? theme.iconBg : 'transparent', borderRadius: 8 }}
                                onPress={() => {
                                  if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  if (count > 0) setRegisterCountedNotes(prev => ({ ...prev, [denom]: count - 1 }));
                                }}
                              >
                                <Ionicons name="remove" size={20} color={count > 0 ? theme.accent : theme.textSub} />
                              </TouchableOpacity>
                              <Text style={{ width: 30, textAlign: 'center', color: theme.textMain, fontSize: 16, fontWeight: '700' }}>{count}</Text>
                              <TouchableOpacity 
                                style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.iconBg, borderRadius: 8 }}
                                onPress={() => {
                                  if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setRegisterCountedNotes(prev => ({ ...prev, [denom]: count + 1 }));
                                }}
                              >
                                <Ionicons name="add" size={20} color={theme.accent} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Botones de Navegación Final */}
                    <View style={{ width: '100%', flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                      
                      <TouchableOpacity 
                        style={{ flex: 1, backgroundColor: 'transparent', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.cardBorder }}
                        activeOpacity={0.8}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setCurrentScreen('Dashboard'); // Volvemos al Dashboard sin cerrar la caja
                        }}
                      >
                        <Text style={{ color: theme.textSub, fontSize: 14, fontWeight: '700' }}>CANCELAR</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{ 
                          flex: 2, 
                          backgroundColor: currentUser.role === 'employee' ? '#059669' : (difference === 0 ? '#4CAF50' : difference < 0 ? '#F44336' : '#2196F3'), 
                          borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', 
                          shadowColor: currentUser.role === 'employee' ? '#059669' : (difference === 0 ? '#4CAF50' : difference < 0 ? '#F44336' : '#2196F3'), 
                          shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8 
                        }}
                        activeOpacity={0.8}
                        onPress={() => {
                          // 1. Transición suave inmediata al Dashboard
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setCurrentScreen('Dashboard');
                          
                          // 2. Cargamos el motor visual (Ciego si es empleado)
                          setAnimType(currentUser.role === 'admin' ? (difference === 0 ? 'perfect_close' : 'warning_close') : 'blind_close');
                          setShowSuccessAnim(true);
                          
                          // 3. Sinfonía Táctil (Haptics)
                          if (isHapticEnabled) {
                            if (currentUser.role === 'employee' || difference === 0) {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
                              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 300);
                            } else {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            }
                          }

                          // 4. Disparamos la animación del trofeo/alerta
                          Animated.spring(popAnim, { toValue: 1, friction: 3, tension: 80, useNativeDriver: true }).start();
                          
                          // 5. Esperamos 2.4 segundos de gloria antes de ocultarlo y mostrar el resumen final
                          setTimeout(() => {
                            Animated.timing(popAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
                              setShowSuccessAnim(false);
                              
                              // LÓGICA DETECTIVESCO-CONTABLE
                              setIsRegisterOpen(false); // Cerramos el turno oficialmente
                              
                              // NOVEDAD: Si es empleado, guardamos el reporte confidencial en la bandeja del Jefe
                              if (currentUser.role === 'employee') {
                                setPendingReports(prev => [...prev, {
                                  id: Date.now().toString(),
                                  employeeName: currentUser.name,
                                  openedBy: registerOpenedBy,
                                  theoretical: theoreticalTotal,
                                  actual: actualTotal,
                                  difference: difference,
                                  time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                                  log: registerLog // Pasamos el libro de auditoría completo
                                }]);
                              }
                              
                              let alertTitle = currentUser.role === 'admin' ? '¡CIERRE PERFECTO!' : 'REPORTE ENVIADO';
                              let alertMessage = currentUser.role === 'admin' 
                                 ? 'El informe de cierre cuadrado al céntimo se ha archivado en tu historial.'
                                 : 'El cuadre de caja ha sido enviado al administrador de forma segura.';
                              
                              if (currentUser.role === 'admin' && difference !== 0) {
                                const absDiff = Math.abs(difference);
                                const isSurplus = difference > 0;
                                const isExactBill = [500, 200, 100, 50, 20, 10, 5].includes(absDiff);
                                const currencySymbol = CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€';
                                
                                alertTitle = isSurplus ? 'SOBRANTE DETECTADO' : 'FALTANTE DETECTADO';
                                
                                let suggestion = '';
                                if (isExactBill) {
                                  suggestion = isSurplus 
                                    ? `💡 Tienes exactamente un billete de ${absDiff}${currencySymbol} de más. ¿Olvidaste anotar una venta o cobraste de más a un cliente?` 
                                    : `💡 Falta exactamente un billete de ${absDiff}${currencySymbol}. Revisa si se ha traspapelado en el cajón o si olvidaste registrar un pago a un proveedor.`;
                                } else {
                                  suggestion = isSurplus 
                                    ? `💡 Tienes ${absDiff.toFixed(2)}${currencySymbol} de más en la caja. Revisa si olvidaste anotar alguna venta rápida o si diste mal un cambio.` 
                                    : `💡 Faltan ${absDiff.toFixed(2)}${currencySymbol} en la caja. Asegúrate de haber anotado todos los pagos del día o revisa si diste cambio de más.`;
                                }
                                
                                alertMessage = `El informe se ha archivado con un ${isSurplus ? 'exceso' : 'descuadre negativo'} de ${absDiff.toFixed(2)}${currencySymbol}.\n\n${suggestion}`;
                              }

                              // Aparece la alerta final inteligente
                              setCustomAlert({
                                visible: true,
                                title: alertTitle,
                                message: alertMessage,
                                type: (currentUser.role === 'employee' || difference === 0) ? 'success' : 'error'
                              });

                              // Aparece la alerta final inteligente
                              setCustomAlert({
                                visible: true,
                                title: alertTitle,
                                message: alertMessage,
                                type: (currentUser.role === 'employee' || difference === 0) ? 'success' : 'error'
                              });
                            });
                          }, 2400);
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }}>CERRAR CAJA</Text>
                      </TouchableOpacity>
                    </View>

                  </View>
                );
              })()}

            </ScrollView>
          </View>
        )}

        {/* PANTALLA 4: CONFIGURACIÓN */}
        {currentScreen === 'Settings' && (
          <View style={styles.settingsScreenContainer}>
            <View style={styles.settingsHeader}>
              <TouchableOpacity 
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCurrentScreen('Dashboard');
                }} 
                style={styles.settingsBackBtn}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="chevron-back" size={24} color="#D8D8DA" style={{ marginLeft: -2 }} />
              </TouchableOpacity>
              <Text style={styles.settingsMainTitle}>CONFIGURACIÓN</Text>
              <View style={styles.settingsHeaderSpacer} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsScroll}>
              <Text style={styles.settingsSectionTitle}>PERFIL DEL USUARIO</Text>
              <View style={styles.settingsBlock}>
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>Editar nombre de usuario</Text>
                  <TextInput 
                    style={styles.settingsTextInput} 
                    value={finalUserName} 
                    onChangeText={setFinalUserName} 
                    placeholderTextColor="#64748B"
                  />
                </View>
                <View style={styles.settingsDividerInternal} />
                <TouchableOpacity style={styles.settingsRow} onPress={() => Alert.alert("Cambiar cuenta", "Redirigiendo a selección de cuenta...")}>
                  <Text style={styles.settingsRowLabel}>Cambiar de cuenta</Text>
                  <Ionicons name="swap-horizontal" size={20} color="#C48A76" />
                </TouchableOpacity>
              </View>

              <Text style={styles.settingsSectionTitle}>PREFERENCIAS DE LA APP</Text>
              <View style={styles.settingsBlock}>
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>Pantalla completa</Text>
                  <Switch 
                    trackColor={{ false: '#12264C', true: 'rgba(196, 138, 118, 0.4)' }}
                    thumbColor={isFullScreen ? '#C48A76' : '#64748B'}
                    onValueChange={setIsFullScreen}
                    value={isFullScreen}
                  />
                </View>
                <View style={styles.settingsDividerInternal} />
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>Privacidad por defecto</Text>
                  <Switch 
                    trackColor={{ false: '#12264C', true: 'rgba(196, 138, 118, 0.4)' }}
                    thumbColor={isPrivacyDefault ? '#C48A76' : '#64748B'}
                    onValueChange={setIsPrivacyDefault}
                    value={isPrivacyDefault}
                  />
                </View>
                <View style={styles.settingsDividerInternal} />
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>Vibración </Text>
                  <Switch 
                    trackColor={{ false: '#12264C', true: 'rgba(196, 138, 118, 0.4)' }}
                    thumbColor={isHapticEnabled ? '#C48A76' : '#64748B'}
                    onValueChange={setIsHapticEnabled}
                    value={isHapticEnabled}
                  />
                </View>
                <View style={styles.settingsDividerInternal} />
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>Sonidos de la app</Text>
                  <Switch 
                    trackColor={{ false: '#12264C', true: 'rgba(196, 138, 118, 0.4)' }}
                    thumbColor={isSoundEnabled ? '#C48A76' : '#64748B'}
                    onValueChange={setIsSoundEnabled}
                    value={isSoundEnabled}
                  />
                </View>
              </View>

              <Text style={styles.settingsSectionTitle}>GESTIÓN DE DATOS</Text>
              <View style={styles.settingsBlock}>
                <TouchableOpacity 
                  style={styles.settingsRow} 
                  onPress={() => {
                    if (userPlan === 'basic') {
                      if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      setCustomAlert({ 
                        visible: true, 
                        title: 'EXPORTACIÓN AVANZADA', 
                        message: 'Genera informes profesionales en PDF o Excel (CSV) para ti o tu gestoría.\n\nMejora tu plan para habilitarlo.', 
                        type: 'error' 
                      });
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setCurrentScreen('Plans');
                    } else {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setCurrentScreen('ExportCenter');
                    }
                  }}
                >
                  <Text style={[styles.settingsRowLabel, userPlan !== 'basic' && {color: '#C48A76', fontWeight: 'bold'}]}>EXPORTACIÓN DE DATOS (PDF/XLSX)</Text>
                  <Ionicons name="document-text" size={20} color={userPlan !== 'basic' ? "#C48A76" : "#D8D8DA"} />
                </TouchableOpacity>
                <View style={styles.settingsDividerInternal} />
                <TouchableOpacity 
                  style={styles.settingsRow} 
                  onPress={() => {
                    Alert.alert(
                      "Borrar Depósitos",
                      "¿Seguro que quieres eliminar TODO el historial y poner los depósitos a cero?",
                      [
                        { text: "Cancelar", style: "cancel" },
                        { 
                          text: "Borrar", 
                          style: "destructive", 
                          onPress: () => {
                            setDeposits([]);
                            setDepositHistory([]);
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={[styles.settingsRowLabel, { color: '#F44336' }]}>Borrar todos los depósitos</Text>
                  <Ionicons name="trash-outline" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
        
{/* --- PANTALLA EXCLUSIVA: CENTRO DE EXPORTACIÓN --- */}
        {/* --- PANTALLA EXCLUSIVA: CENTRO DE EXPORTACIÓN --- */}
        {currentScreen === 'ExportCenter' && (
          <View style={[styles.settingsScreenContainer, { paddingHorizontal: 0 }]}>
            
            <View style={[styles.settingsHeader, { marginBottom: 10, paddingHorizontal: 24 }]}>
              <TouchableOpacity 
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentScreen('Settings'); }} 
                style={styles.settingsBackBtn} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="chevron-back" size={24} color="#D8D8DA" style={{ marginLeft: -2 }} />
              </TouchableOpacity>
              <Text style={styles.settingsMainTitle}>INFORMES</Text>
              <View style={styles.settingsHeaderSpacer} />
            </View>

            {/* MOTOR MATEMÁTICO DEL GRÁFICO DINÁMICO */}
            {(() => {
              // 1. Filtrar los movimientos según el alcance elegido
              let relevantHistory = [];
              activedeposits.forEach(dep => {
                if (exportScope === 'all' || exportScope === dep.id) {
                  if (dep.history) relevantHistory.push(...dep.history);
                }
              });

              // 2. Coger los últimos 4 movimientos para el gráfico
              let chartData = relevantHistory.slice(0, 4);
              if (chartData.length === 0) {
                chartData = [{amount: 0, concept: '-'}, {amount: 0, concept: '-'}, {amount: 0, concept: '-'}, {amount: 0, concept: '-'}];
              }

              // 3. Calcular el Eje Y (Valor Máximo)
              const maxAmount = Math.max(...chartData.map(d => d.amount), 100); // Mínimo 100 para evitar dividir por 0
              const formatY = (val) => val >= 1000 ? (val/1000).toFixed(1) + 'k' : val.toFixed(0);

              return (
                <ScrollView 
                  style={{ flex: 1, width: '100%' }} 
                  showsVerticalScrollIndicator={false} 
                  contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                >
                  
                  {/* 1. Selector de Formato */}
                  <Text style={styles.settingsSectionTitle}>1. FORMATO DEL DOCUMENTO</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    <TouchableOpacity 
                      style={[{ flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', backgroundColor: 'rgba(216, 216, 218, 0.03)', alignItems: 'center'}, exportFormat === 'pdf' && {borderColor: '#F44336', backgroundColor: 'rgba(244, 67, 54, 0.1)'}]}
                      onPress={() => { setExportFormat('pdf'); if(isHapticEnabled) Haptics.selectionAsync(); }}
                    >
                      <Ionicons name="document-text" size={32} color={exportFormat === 'pdf' ? "#F44336" : "#64748B"} style={{marginBottom: 8}} />
                      <Text style={{color: exportFormat === 'pdf' ? '#F44336' : '#94A3B8', fontWeight: 'bold'}}>PDF Visual</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[{ flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', backgroundColor: 'rgba(216, 216, 218, 0.03)', alignItems: 'center'}, exportFormat === 'excel' && {borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)'}]}
                      onPress={() => { setExportFormat('excel'); if(isHapticEnabled) Haptics.selectionAsync(); }}
                    >
                      <Ionicons name="grid" size={32} color={exportFormat === 'excel' ? "#4CAF50" : "#64748B"} style={{marginBottom: 8}} />
                      <Text style={{color: exportFormat === 'excel' ? '#4CAF50' : '#94A3B8', fontWeight: 'bold'}}>Excel (CSV)</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 2. ALCANCE DE LOS DATOS (Arreglado con flexWrap) */}
                  <Text style={styles.settingsSectionTitle}>2. ALCANCE DE LOS DATOS Y SELECCION DE DEPÓSITOS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                    <TouchableOpacity 
                      style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: exportScope === 'all' ? '#C48A76' : 'rgba(216, 216, 218, 0.1)', backgroundColor: exportScope === 'all' ? 'rgba(196, 138, 118, 0.15)' : 'transparent' }}
                      onPress={() => { setExportScope('all'); if(isHapticEnabled) Haptics.selectionAsync(); }}
                    >
                      <Text style={{ color: exportScope === 'all' ? '#C48A76' : '#94A3B8', fontWeight: '600', fontSize: 13 }}>BALANCE GLOBAL</Text>
                    </TouchableOpacity>
                    {activedeposits.map(dep => (
                      <TouchableOpacity 
                        key={`export-dep-${dep.id}`}
                        style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: exportScope === dep.id ? '#C48A76' : 'rgba(216, 216, 218, 0.1)', backgroundColor: exportScope === dep.id ? 'rgba(196, 138, 118, 0.15)' : 'transparent' }}
                        onPress={() => { setExportScope(dep.id); if(isHapticEnabled) Haptics.selectionAsync(); }}
                      >
                        <Text style={{ color: exportScope === dep.id ? '#C48A76' : '#94A3B8', fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{dep.name || 'Sin nombre'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 3. RANGO DE TIEMPO (Arreglado con flexWrap) */}
                  <Text style={styles.settingsSectionTitle}>3. RANGO DE TIEMPO</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                    {[
                      { id: 'current_month', label: 'Mes actual' },
                      { id: 'last_month', label: 'Mes pasado' },
                      { id: 'year', label: 'Todo el año' }
                    ].map(range => (
                      <TouchableOpacity 
                        key={range.id}
                        style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: exportTimeRange === range.id ? '#C48A76' : 'rgba(216, 216, 218, 0.1)', backgroundColor: exportTimeRange === range.id ? 'rgba(196, 138, 118, 0.15)' : 'transparent' }}
                        onPress={() => { setExportTimeRange(range.id); if(isHapticEnabled) Haptics.selectionAsync(); }}
                      >
                        <Text style={{ color: exportTimeRange === range.id ? '#C48A76' : '#94A3B8', fontWeight: '600', fontSize: 13 }}>{range.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 4. AJUSTES FINOS Y BUSINESS */}
                  <Text style={styles.settingsSectionTitle}>4. CONFIGURACIÓN ADICIONAL</Text>
                  <View style={styles.settingsBlock}>
                    <View style={styles.settingsRow}>
                      <Text style={styles.settingsRowLabel}>Incluir desglose de billetes</Text>
                      <Switch trackColor={{ false: 'rgba(216,216,218,0.1)', true: 'rgba(196,138,118,0.4)' }} thumbColor={exportIncludeNotes ? '#C48A76' : '#64748B'} value={exportIncludeNotes} onValueChange={setExportIncludeNotes} />
                    </View>
                    <View style={styles.settingsDividerInternal} />
                    
                    {/* GANCHO BUSINESS */}
                    <TouchableOpacity 
                      style={styles.settingsRow} 
                      activeOpacity={0.8}
                      onPress={() => {
                        if (userPlan !== 'business') {
                          if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          setCustomAlert({ 
                            visible: true, 
                            title: 'FUNCIÓN BUSINESS', 
                            message: 'La separación fiscal de IVA y exportación para contables es exclusiva del plan BUSINESS.\n\nMejora tu plan para habilitarlo.', 
                            type: 'error' 
                          });
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setCurrentScreen('Plans'); 
                        } else {
                          setExportIncludeTax(!exportIncludeTax);
                          if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                    >
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={[styles.settingsRowLabel, userPlan !== 'business' && {color: '#64748B'}]}>Separación Fiscal (IVA)</Text>
                        {userPlan !== 'business' && <Ionicons name="lock-closed" size={14} color="#F44336" style={{marginLeft: 8}} />}
                      </View>
                      <Switch trackColor={{ false: 'rgba(216,216,218,0.1)', true: 'rgba(4,120,87,0.4)' }} thumbColor={exportIncludeTax ? '#059669' : '#64748B'} value={exportIncludeTax} disabled={true} />
                    </TouchableOpacity>
                  </View>

                  {/* 5. PREVISUALIZACIÓN DEL MOTOR GRÁFICO DINÁMICO */}
                  <Text style={[styles.settingsSectionTitle, {marginTop: 10}]}>5. PREVISUALIZACIÓN DEL REPORTE</Text>
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 30 }}>
                    <Text style={{color: '#111A42', fontSize: 16, fontWeight: '900', marginBottom: 4}}>Reporte Financiero SUELTO</Text>
                    <Text style={{color: '#64748B', fontSize: 12, marginBottom: 20}}>
                      {exportScope === 'all' ? 'Balance global' : (activedeposits.find(d => d.id === exportScope)?.name || 'Bóveda')} • {exportTimeRange === 'current_month' ? 'Mes actual' : exportTimeRange === 'last_month' ? 'Mes pasado' : 'Todo el año'}
                    </Text>
                    
                    {/* EJE Y (Ordenadas) y EJE X (Abscisas) */}
                    <View style={{ flexDirection: 'row', height: 160 }}>
                      
                      {/* Eje Y (Dinámico) */}
                      <View style={{ justifyContent: 'space-between', paddingRight: 8, borderRightWidth: 1, borderRightColor: '#E2E8F0', alignItems: 'flex-end', paddingVertical: 10, width: 40 }}>
                        <Text style={{fontSize: 10, color: '#94A3B8', fontWeight: 'bold'}}>{formatY(maxAmount)}</Text>
                        <Text style={{fontSize: 10, color: '#94A3B8', fontWeight: 'bold'}}>{formatY(maxAmount / 2)}</Text>
                        <Text style={{fontSize: 10, color: '#94A3B8', fontWeight: 'bold'}}>0</Text>
                      </View>
                      
                      {/* Área del Gráfico */}
                      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingBottom: 25, paddingLeft: 8 }}>
                        
                        {chartData.map((data, index) => {
                          // Altura porcentual basada en el máximo (Mínimo 2% para que se vea algo)
                          const barHeight = Math.max((data.amount / maxAmount) * 100, 2);
                          const isIncome = data.type !== 'out'; // Si es retiro lo pintamos distinto
                          const barColor = exportFormat === 'excel' ? '#4CAF50' : (isIncome ? '#111A42' : '#C48A76');

                          return (
                            <View key={`bar-${index}`} style={{ alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                              <View style={{ width: 28, height: `${barHeight}%`, backgroundColor: barColor, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
                              <Text style={{position: 'absolute', bottom: -20, fontSize: 10, color: '#64748B', width: 40, textAlign: 'center'}} numberOfLines={1}>
                                {data.concept ? data.concept.substring(0,5) : `Mov ${index+1}`}
                              </Text>
                            </View>
                          );
                        })}
                        
                        {/* Eje X Línea Base */}
                        <View style={{ position: 'absolute', bottom: 25, left: 0, right: 0, height: 1, backgroundColor: '#E2E8F0' }} />
                      </View>
                    </View>
                  </View>

                  {/* Botón de Generar */}
                  <TouchableOpacity 
                    style={[styles.planBtn, { backgroundColor: exportFormat === 'excel' ? '#4CAF50' : '#F44336' }]} 
                    activeOpacity={0.9}
                    onPress={() => {
                      if(isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      
                      if (exportFormat === 'excel') {
                        let csvString = "FECHA,BÓVEDA,TIPO,CONCEPTO,CANTIDAD,BALANCE_TRAS_OPERACION\n";
                        relevantHistory.forEach(mov => {
                          csvString += `${mov.date},Exportación,${mov.type === 'in' ? 'INGRESO' : 'RETIRADA'},${mov.concept || 'Sin concepto'},${mov.amount},${mov.balanceAfter}\n`;
                        });
                        if (csvString === "FECHA,BÓVEDA,TIPO,CONCEPTO,CANTIDAD,BALANCE_TRAS_OPERACION\n") {
                          Alert.alert("Aviso", "No hay movimientos para los filtros seleccionados.");
                          return;
                        }
                        Share.share({ message: csvString, title: 'Exportacion_SUELTO' });
                      } else {
                        Alert.alert("Generando PDF...", "El motor gráfico está empaquetando tu reporte visual.\n(Aquí se conectará la API nativa de PDF).");
                      }
                    }}
                  >
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Ionicons name="share-outline" size={20} color="#FFFFFF" style={{marginRight: 8}} />
                      <Text style={[styles.planBtnText, { color: '#FFFFFF' }]}>COMPARTIR {exportFormat.toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>

                </ScrollView>
              );
            })()}

          </View>
        )}

      {/* PANTALLA 5: SEGURIDAD */}
        {currentScreen === 'Security' && (
          <View style={styles.settingsScreenContainer}>
            <View style={styles.settingsHeader}>
              <TouchableOpacity 
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCurrentScreen('Dashboard');
                }} 
                style={styles.settingsBackBtn}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="chevron-back" size={24} color="#D8D8DA" style={{ marginLeft: -2 }} />
              </TouchableOpacity>
              <Text style={styles.settingsMainTitle}>SEGURIDAD</Text>
              <View style={styles.settingsHeaderSpacer} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsScroll}>
              <Text style={styles.settingsSectionTitle}>CONTROL DE ACCESO</Text>
              <View style={styles.settingsBlock}>
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>Activar PIN (4 dígitos)</Text>
                  <Switch 
                    trackColor={{ false: '#12264C', true: 'rgba(196, 138, 118, 0.4)' }}
                    thumbColor={isPinEnabled ? '#C48A76' : '#64748B'}
                    onValueChange={(val) => {
                      if (val) {
                        setEnteredPin('');
                        setLockMode('setup');
                      } else {
                        setIsPinEnabled(false);
                        setIsBiometricEnabled(false);
                        setUserPin('');
                      }
                    }}
                    value={isPinEnabled}
                  />
                </View>
                
                {hasBiometricHardware && (
                  <>
                    <View style={styles.settingsDividerInternal} />
                    <View style={styles.settingsRow}>
                      <Text style={[styles.settingsRowLabel, !isPinEnabled && {color: '#64748B'}]}>Desbloqueo Biométrico</Text>
                      <Switch 
                        trackColor={{ false: '#12264C', true: 'rgba(196, 138, 118, 0.4)' }}
                        thumbColor={isBiometricEnabled ? '#C48A76' : '#64748B'}
                        onValueChange={setIsBiometricEnabled}
                        value={isBiometricEnabled}
                        disabled={!isPinEnabled}
                      />
                    </View>
                  </>
                )}
              </View>

              {isPinEnabled && (
                <>
                  <Text style={styles.settingsSectionTitle}>SEGURIDAD INMEDIATA</Text>
                  <View style={styles.settingsBlock}>
                    <TouchableOpacity 
                      style={styles.settingsRow} 
                      onPress={() => {
                        setEnteredPin('');
                        setLockMode('unlock');
                        if (isBiometricEnabled) {
                           handleBiometricAuth();
                        }
                      }}
                    >
                      <Text style={[styles.settingsRowLabel, { color: '#C48A76' }]}>BLOQUEAR APP AHORA</Text>
                      <Ionicons name="lock-closed" size={20} color="#C48A76" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {/* ESTADO VACÍO: CANDADO GIGANTE CUANDO EL PIN ESTÁ DESACTIVADO */}
              {!isPinEnabled && (
                <View style={{ alignItems: 'center', marginTop: 80, paddingBottom: 40 }}>
                  <View style={{ width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(196, 138, 118, 0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(196, 138, 118, 0.15)' }}>
                    <Ionicons name="lock-closed" size={110} color="#C48A76" />
                  </View>
                </View>
              )}

              {isPinEnabled && (
                <>
                  <Text style={styles.settingsSectionTitle}>SEGURIDAD AVANZADA</Text>
                  <View style={styles.settingsBlock}>
                    
                    <TouchableOpacity style={styles.settingsRow} onPress={() => {
                      const nextSetting = autoLockSetting === 0 ? 60 : autoLockSetting === 60 ? 300 : 0;
                      setAutoLockSetting(nextSetting);
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.settingsRowLabel}>Bloqueo Automático</Text>
                        <TouchableOpacity 
                          onPress={() => setIsAutoLockInfoVisible(true)} 
                          style={{ marginLeft: 6, marginTop: -8 }}
                          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                        >
                          <Ionicons name="help-circle-outline" size={16} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.settingsTextInput}>
                        {autoLockSetting === 0 ? 'Inmediato' : autoLockSetting === 60 ? 'Tras 1 min' : 'Tras 5 min'}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.settingsDividerInternal} />
                    
                    <TouchableOpacity style={styles.settingsRow} onPress={() => {
                      setEnteredPin('');
                      setLockMode('panic-setup');
                    }}>
                      <View>
                        <Text style={[styles.settingsRowLabel, { color: '#F44336' }]}>Configurar PIN de Pánico</Text>
                        <Text style={{color: '#64748B', fontSize: 12, marginTop: 4}}>Borrado total bajo amenaza</Text>
                      </View>
                      <Ionicons name="skull-outline" size={20} color="#F44336" />
                    </TouchableOpacity>

                  </View>
                </>
              )}
            </ScrollView>
          </View>
        )}
      {/* PANTALLA DE PLANES */}
      {currentScreen === 'Plans' && (
        <View style={styles.settingsScreenContainer}>
          <View style={[styles.settingsHeader, { marginBottom: 10 }]}>
            <TouchableOpacity 
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setCurrentScreen('Dashboard');
              }} 
              style={styles.settingsBackBtn}
              hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
            >
              <Ionicons name="chevron-back" size={24} color="#D8D8DA" style={{ marginLeft: -2 }} />
            </TouchableOpacity>
            <Text style={styles.settingsMainTitle}>PLANES SUELTO</Text>
            <View style={styles.settingsHeaderSpacer} />
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.plansScrollContainer}
            snapToInterval={Dimensions.get('window').width * 0.82 + 16}
            decelerationRate="fast"
            snapToAlignment="center"
          >
            {/* PLAN BÁSICO */}
            <View style={[styles.planCard, { backgroundColor: '#1E293B', borderColor: '#475569' }]}>
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { color: '#94A3B8' }]}>BÁSICO</Text>
                <Text style={styles.planPrice}>0,00 € <Text style={styles.planPeriod}>/ mes</Text></Text>
                <Text style={styles.planDesc}>Funcional y seguro, pero restrictivo.</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.planFeaturesScroll}>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#94A3B8" /><Text style={styles.planFeatureText}>Seguridad estándar (PIN y Biometría)</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#94A3B8" /><Text style={styles.planFeatureText}>Multidivisa local</Text></View>
                
                <Text style={[styles.planFeatureSubTitle, {color: '#F44336', marginTop: 12}]}>Limitaciones del plan:</Text>
                
                <View style={styles.planFeatureRow}><Ionicons name="alert-circle" size={20} color="#F44336" /><Text style={[styles.planFeatureText, {color: '#94A3B8'}]}>Máximo 2 depósitos <Text style={{fontSize: 12}}>(Sin libertad de expansión)</Text></Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="alert-circle" size={20} color="#F44336" /><Text style={[styles.planFeatureText, {color: '#94A3B8'}]}>Datos 100% locales <Text style={{fontSize: 12}}>(Si extravías tu dispositivo, pierdes todo tu historial)</Text></Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="alert-circle" size={20} color="#F44336" /><Text style={[styles.planFeatureText, {color: '#94A3B8'}]}>Contiene anuncios publicitarios</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="close-circle" size={20} color="#F44336" /><Text style={[styles.planFeatureText, {color: '#64748B', textDecorationLine: 'line-through'}]}>Gráficos avanzados y automatización</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="close-circle" size={20} color="#F44336" /><Text style={[styles.planFeatureText, {color: '#64748B', textDecorationLine: 'line-through'}]}>FUNCIÓN "Cierre de Caja"</Text></View>
              </ScrollView>
              {userPlan === 'basic' ? (
                <View style={[styles.planBtn, { backgroundColor: 'rgba(148, 163, 184, 0.2)' }]}>
                  <Text style={[styles.planBtnText, { color: '#94A3B8' }]}>TU PLAN ACTUAL</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.planBtn, { backgroundColor: 'rgba(148, 163, 184, 0.2)' }]} 
                  onPress={() => {
                    Alert.alert(
                      "¿Bajar de plan?",
                      userPlan === 'business' 
                        ? "Perderás el Cierre de Caja, el Escáner IA y la sincronización en la nube. Tus datos quedarán atrapados solo en este dispositivo."
                        : "Perderás las bóvedas ilimitadas, la sincronización en la nube y la automatización. Tus datos volverán a ser 100% locales.",
                      [
                        { text: "Me quedo", style: "cancel" },
                        { 
                          text: "Sí, bajar de plan", 
                          style: "destructive",
                          onPress: () => {
                            setUserPlan('basic');
                            if(isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={[styles.planBtnText, { color: '#94A3B8' }]}>VOLVER AL BÁSICO</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* PLAN PREMIUM */}
            <View style={[styles.planCard, { backgroundColor: 'rgba(196, 138, 118, 0.1)', borderColor: '#C48A76' }]}>
              <View style={styles.planHeader}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Ionicons name="star" size={18} color="#C48A76" style={{marginRight: 6}} />
                  <Text style={[styles.planTitle, { color: '#C48A76' }]}>PREMIUM</Text>
                </View>
                <Text style={styles.planPrice}>1,99 € <Text style={styles.planPeriod}>/ mes</Text></Text>
                <Text style={styles.planDesc}>Libertad, control total y comodidad sin límites.</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.planFeaturesScroll}>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#C48A76" /><Text style={styles.planFeatureText}>Sin anuncios, 100% limpio</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#C48A76" /><Text style={styles.planFeatureText}>Depósitos ilimitados</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#C48A76" /><Text style={styles.planFeatureText}>Datos en la nube, sincronizables con otros dispositivos</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#C48A76" /><Text style={styles.planFeatureText}>Depósitos compartidos con otras cuentas</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#C48A76" /><Text style={styles.planFeatureText}>Automatización de saldo mensual</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#C48A76" /><Text style={styles.planFeatureText}>Gráficos avanzados y metas de ahorro</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={20} color="#C48A76" /><Text style={styles.planFeatureText}>Descuentos exclusivos en nuestra tienda</Text></View>
              </ScrollView>
              {userPlan === 'premium' ? (
                <View style={[styles.planBtn, { backgroundColor: 'rgba(196, 138, 118, 0.2)' }]}>
                  <Text style={[styles.planBtnText, { color: '#C48A76' }]}>TU PLAN ACTUAL</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.planBtn, { backgroundColor: '#C48A76' }]} 
                  onPress={() => {
                    if (userPlan === 'business') {
                      Alert.alert(
                        "¿Renunciar al modo Business?",
                        "Perderás el Escáner IA, el Cierre de Caja profesional y la gestión fiscal de IVA. Tu cuenta volverá al modo personal.",
                        [
                          { text: "Mantener Business", style: "cancel" },
                          { 
                            text: "Bajar a Premium", 
                            style: "destructive",
                            onPress: () => {
                              setUserPlan('premium');
                              if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                          }
                        ]
                      );
                    } else {
                      // Subiendo desde Básico
                      setUserPlan('premium');
                      console.log("☁️ [Supabase Sync] Subiendo historial completo a la nube...", deposits);
                      if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setCustomAlert({ 
                        visible: true, 
                        title: '¡BIENVENIDO A PREMIUM!', 
                        message: 'Tu plan se ha activado. Tus bóvedas se están cifrando y sincronizando en la nube de forma segura. Ya puedes acceder desde cualquier dispositivo.', 
                        type: 'success' 
                      });
                    }
                  }}
                >
                  <Text style={[styles.planBtnText, { color: '#111A42' }]}>
                    {userPlan === 'business' ? 'VOLVER A PREMIUM' : 'PASAR A PREMIUM'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* PLAN BUSINESS */}
            <View style={[styles.planCard, { backgroundColor: 'rgba(4, 120, 87, 0.1)', borderColor: '#047857' }]}>
              <View style={styles.planHeader}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Ionicons name="briefcase" size={18} color="#059669" style={{marginRight: 6}} />
                  <Text style={[styles.planTitle, { color: '#059669' }]}>BUSINESS</Text>
                </View>
                <Text style={styles.planPrice}>5,99 € <Text style={styles.planPeriod}>/ mes</Text></Text>
                <Text style={styles.planDesc}>El copiloto financiero sobre tu efectivo definitivo para el negocio.</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.planFeaturesScroll}>
                <Text style={styles.planFeatureSubTitle}>TODO LO DE PREMIUM, y además:</Text>
                
                <View style={styles.planFeatureRow}><Ionicons name="scan-outline" size={20} color="#059669" /><Text style={styles.planFeatureText}>Escáner IA (OCR): Ingresos vs Gastos</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="sync" size={20} color="#059669" /><Text style={styles.planFeatureText}>Interruptor Modo Profesional / Modo Personal</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="people-outline" size={20} color="#059669" /><Text style={styles.planFeatureText}>Acceso multi-usuario con roles  (Jefe / Empleado)</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="document-text-outline" size={20} color="#059669" /><Text style={styles.planFeatureText}>Gestión fiscal (bóveda de IVA separada)</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="mail-outline" size={20} color="#059669" /><Text style={styles.planFeatureText}>Exportación contable directa y precisa para tu gestor</Text></View>
                
                <View style={[styles.planFeatureBox, { borderColor: 'rgba(4, 120, 87, 0.4)', backgroundColor: 'rgba(4, 120, 87, 0.05)' }]}>
                  <Text style={[styles.planFeatureSubTitle, {color: '#059669', marginBottom: 8, marginTop: 0, fontSize: 13}]}>⭐ EXCLUSIVO: CIERRE DE CAJA</Text>
                  <Text style={styles.planFeatureMiniText}>• <Text style={{fontWeight:'bold', color:'#D8D8DA'}}>Apertura:</Text> fija el dinero base de la caja ("Ej: 300€").</Text>
                  <Text style={styles.planFeatureMiniText}>• <Text style={{fontWeight:'bold', color:'#D8D8DA'}}>Quick sell:</Text> suma ventas del día rápidamente.</Text>
                  <Text style={styles.planFeatureMiniText}>• <Text style={{fontWeight:'bold', color:'#D8D8DA'}}>Quick expense:</Text> pagos a proveedores con hora exacta.</Text>
                  <Text style={styles.planFeatureMiniText}>• <Text style={{fontWeight:'bold', color:'#D8D8DA'}}>Cuadre inteligente:</Text> la app calcula lo que deberías tener. Mete tu conteo y te alerta si hay descuadres. ¡CON ALERTAS Y CORRECTOR!</Text>
                </View>
              </ScrollView>
              {userPlan === 'business' ? (
                <View style={[styles.planBtn, { backgroundColor: 'rgba(4, 120, 87, 0.2)' }]}>
                  <Text style={[styles.planBtnText, { color: '#059669' }]}>TU PLAN ACTUAL</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.planBtn, { backgroundColor: '#047857' }]} 
                  onPress={() => {
                    setUserPlan('business');
                    if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setCustomAlert({ 
                      visible: true, 
                      title: '¡MODO BUSINESS ACTIVADO!', 
                      message: 'Bienvenido al copiloto contable de SUELTO. Ahora tienes acceso al CIERRE DE CAJA y gestión fiscal.', 
                      type: 'success' 
                    });
                  }}
                >
                  <Text style={[styles.planBtnText, { color: '#FFFFFF' }]}>PASAR A BUSINESS</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      )}  
      {/* PANTALLA 6: MENÚ CENTRO DE AYUDA */}
        {currentScreen === 'HelpCenter' && (
          <View style={styles.settingsScreenContainer}>
            <View style={styles.settingsHeader}>
              <TouchableOpacity 
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCurrentScreen('Dashboard');
                }} 
                style={styles.settingsBackBtn}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="chevron-back" size={24} color="#D8D8DA" style={{ marginLeft: -2 }} />
              </TouchableOpacity>
              <Text style={styles.settingsMainTitle}>SOPORTE</Text>
              <View style={styles.settingsHeaderSpacer} />
            </View>

            <View style={styles.helpCenterContent}>
              <Text style={styles.helpCenterSubtitle}>¿Cómo prefieres que te ayudemos?</Text>
              
              <TouchableOpacity 
                style={styles.helpBigCard} 
                activeOpacity={0.8}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCurrentScreen('ChatBot');
                }}
              >
                <View style={[styles.helpIconCircle, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                  <Ionicons name="chatbubbles" size={32} color="#4CAF50" />
                </View>
                <View style={styles.helpTextCol}>
                  <Text style={styles.helpCardTitle}>Asistente Virtual</Text>
                  <Text style={styles.helpCardSub}>Respuestas inmediatas a dudas frecuentes (24/7)</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748B" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.helpBigCard} 
                activeOpacity={0.8}
                onPress={handleEmailSupport}
              >
                <View style={[styles.helpIconCircle, { backgroundColor: 'rgba(196, 138, 118, 0.15)' }]}>
                  <Ionicons name="mail" size={32} color="#C48A76" />
                </View>
                <View style={styles.helpTextCol}>
                  <Text style={styles.helpCardTitle}>Soporte por Correo</Text>
                  <Text style={styles.helpCardSub}>suelto.app@gmail.com. Te leemos y contestamos.</Text>
                </View>
                <Ionicons name="open-outline" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PANTALLA 7: CHATBOT */}
        {currentScreen === 'ChatBot' && (
          <View style={styles.settingsScreenContainer}>
            <View style={[styles.settingsHeader, { marginBottom: 10 }]}>
              <TouchableOpacity 
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCurrentScreen('HelpCenter');
                }} 
                style={styles.settingsBackBtn}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="chevron-back" size={24} color="#D8D8DA" style={{ marginLeft: -2 }} />
              </TouchableOpacity>
              <View style={{alignItems: 'center'}}>
                <Text style={[styles.settingsMainTitle, {fontSize: 18}]}>ASISTENTE SUELTO</Text>
                <Text style={{color: '#4CAF50', fontSize: 12, fontWeight: '700'}}>● En línea</Text>
              </View>
              <View style={styles.settingsHeaderSpacer} />
            </View>

            <ScrollView 
              ref={chatScrollRef}
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.chatScroll}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {chatMessages.map((msg) => (
                <View key={msg.id} style={[styles.chatBubbleWrapper, msg.sender === 'user' ? styles.chatBubbleRight : styles.chatBubbleLeft]}>
                  {msg.sender === 'bot' && (
                    <View style={styles.botAvatar}>
                      <FontAwesome5 name="robot" size={14} color="#111A42" />
                    </View>
                  )}
                  <View style={[styles.chatBubble, msg.sender === 'user' ? styles.chatUser : styles.chatBot]}>
                    <Text style={[styles.chatText, msg.sender === 'user' ? styles.chatTextUser : styles.chatTextBot]}>
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))}

              {isBotTyping && (
                <View style={[styles.chatBubbleWrapper, styles.chatBubbleLeft]}>
                  <View style={styles.botAvatar}>
                    <FontAwesome5 name="robot" size={14} color="#111A42" />
                  </View>
                  <View style={[styles.chatBubble, styles.chatBot]}>
                    <Text style={[styles.chatText, styles.chatTextBot, {fontStyle: 'italic', color: '#64748B'}]}>Escribiendo...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.chatInputArea}>
              <Text style={styles.chatHelperText}>Selecciona una opción para responder:</Text>
              <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={true} contentContainerStyle={styles.chatOptionsScroll}>
                {chatOptions.map((opt, idx) => (
                  <TouchableOpacity key={`opt-${idx}`} style={styles.chatOptionChip} onPress={() => handleChatOption(opt)}>
                    <Text style={styles.chatOptionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      {/* PANTALLA 8: ¿QUIÉNES SOMOS? (Manifiesto) */}
        {currentScreen === 'AboutUs' && (
          <View style={styles.settingsScreenContainer}>
            <View style={styles.settingsHeader}>
              <TouchableOpacity 
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCurrentScreen('Dashboard');
                }} 
                style={styles.settingsBackBtn}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="chevron-back" size={24} color="#D8D8DA" style={{ marginLeft: -2 }} />
              </TouchableOpacity>
              <Text style={styles.settingsMainTitle}>¿QUIÉNES SOMOS?</Text>
              <View style={styles.settingsHeaderSpacer} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.aboutScrollContainer}>
              
              <View style={styles.aboutTopHeader}>
                <Image source={require('./assets/image_e9d0a5.jpg')} style={styles.aboutLogoCentered} />
                <Text style={styles.aboutSloganMain}>Gestiona tu efectivo, gestiona tu libertad</Text>
              </View>

              <View style={styles.aboutTextWrapper}>
                {/* PÁRRAFO 1 CON "cash" EN CURSIVA */}
                {aboutCharCount <= aboutP1_1.length && (
                  <Text style={styles.aboutText}>{aboutP1_1.substring(0, aboutCharCount)}</Text>
                )}
                {aboutCharCount > aboutP1_1.length && (
                  <Text style={styles.aboutText}>
                    {aboutP1_1}
                    <Text style={{ fontStyle: 'italic' }}>
                      {aboutP1_2.substring(0, aboutCharCount - aboutP1_1.length)}
                    </Text>
                    {aboutP1_3.substring(0, aboutCharCount - aboutP1_1.length - aboutP1_2.length)}
                  </Text>
                )}
                
                {/* ICONO 1: Dinero físico / Cash */}
                {aboutCharCount >= aboutP1.length && (
                  <View style={styles.aboutIconSeparator}><Ionicons name="cash-outline" size={32} color="#C48A76" /></View>
                )}

                {/* PÁRRAFO 2 */}
                {aboutCharCount > aboutP1.length && (
                  <Text style={styles.aboutText}>{aboutP2.substring(0, aboutCharCount - aboutP1.length)}</Text>
                )}

                {/* ICONO 2: Control en tiempo real / Gráficos */}
                {aboutCharCount >= (aboutP1.length + aboutP2.length) && (
                  <View style={styles.aboutIconSeparator}><Ionicons name="bar-chart-outline" size={30} color="#C48A76" /></View>
                )}

                {/* PÁRRAFO 3 */}
                {aboutCharCount > (aboutP1.length + aboutP2.length) && (
                  <Text style={styles.aboutText}>{aboutP3.substring(0, aboutCharCount - aboutP1.length - aboutP2.length)}</Text>
                )}

                {/* ICONO 3: Privacidad estricta / Registros tuyos */}
                {aboutCharCount >= (aboutP1.length + aboutP2.length + aboutP3.length) && (
                  <View style={styles.aboutIconSeparator}><Ionicons name="lock-closed-outline" size={30} color="#C48A76" /></View>
                )}

                {/* PÁRRAFO 4 (Destacado y limpio) */}
                {aboutCharCount > (aboutP1.length + aboutP2.length + aboutP3.length) && (
                  <Text style={[styles.aboutText, styles.aboutTextHighlight]}>
                    {aboutP4.substring(0, aboutCharCount - aboutP1.length - aboutP2.length - aboutP3.length)}
                  </Text>
                )}
              </View>

            </ScrollView>
          </View>
        )}  
      {/* --- MODAL FLOTANTE DE AJUSTES --- */}
      <Modal animationType="none" transparent={true} visible={isSettingsVisible} onRequestClose={() => closeSettings()}>
        <TouchableOpacity style={styles.settingsOverlay} activeOpacity={1} onPress={() => closeSettings()}>
          <Animated.View style={[
            styles.settingsMenu,
            {
              opacity: settingsAnim,
              transform: [
                { scale: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                { translateY: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }
              ]
            }
          ]}>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => handleSettingsOption('Configuración')}>
              <Ionicons name="settings-outline" size={24} color="#D8D8DA" style={styles.settingsIcon} />
              <Text style={styles.settingsBtnText}>Configuración</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsBtn} onPress={() => handleSettingsOption('Seguridad')}>
              <Ionicons name="lock-closed-outline" size={24} color="#D8D8DA" style={styles.settingsIcon} />
              <Text style={styles.settingsBtnText}>Seguridad</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsBtn} onPress={() => handleSettingsOption('Información sobre planes')}>
              <Ionicons name="star-outline" size={24} color="#D8D8DA" style={styles.settingsIcon} />
              <Text style={styles.settingsBtnText}>Información sobre planes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsBtn} onPress={() => handleSettingsOption('Centro de ayuda')}>
              <Ionicons name="help-buoy-outline" size={24} color="#D8D8DA" style={styles.settingsIcon} />
              <Text style={styles.settingsBtnText}>Centro de ayuda</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={24} color="#D8D8DA" style={styles.settingsIcon} />
              <Text style={styles.settingsBtnText}>¡Comparte la app! ↗️</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsBtn} onPress={() => handleSettingsOption('¿Quiénes somos?')}>
              <Ionicons name="people-outline" size={24} color="#D8D8DA" style={styles.settingsIcon} />
              <Text style={styles.settingsBtnText}>¿Quiénes somos?</Text>
            </TouchableOpacity>

            <View style={styles.settingsDivider} />

            <TouchableOpacity style={styles.settingsBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#C62828" style={styles.settingsIcon} />
              <Text style={[styles.settingsBtnText, styles.settingsLogoutText]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* --- MODAL (BOTTOM SHEET) PARA INGRESOS / RETIRADAS --- */}
      <Modal animationType="slide" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <View style={styles.toggleContainer}>
                <TouchableOpacity style={[styles.toggleBtn, operationType === 'in' && styles.toggleBtnIn]} onPress={() => setOperationType('in')}>
                  <Text style={[styles.toggleText, operationType === 'in' && styles.toggleTextActive]}>INGRESAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, operationType === 'out' && styles.toggleBtnOut]} onPress={() => setOperationType('out')}>
                  <Text style={[styles.toggleText, operationType === 'out' && styles.toggleTextActive]}>RETIRAR</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close-circle" size={28} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.operationTotalBox}>
              <Text style={styles.operationTotalLabel}>TOTAL {operationType === 'in' ? 'A INGRESAR' : 'A RETIRAR'}</Text>
              <Text style={[styles.operationTotalAmount, { color: operationType === 'in' ? "#4CAF50" : "#F44336" }]}>
                {operationType === 'in' ? '+' : '-'}{getOperationTotal().toLocaleString('en-US', {minimumFractionDigits: 2})} {CURRENCIES.find(c => c.id === activeDeposit.currencyId)?.symbol}
              </Text>
            </View>

            {/* ENVOLVEMOS TODO EN EL SCROLLVIEW DESDE AQUÍ */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              
              <View style={styles.conceptInputWrapper}>
                <Ionicons name="pricetag-outline" size={16} color="#64748B" style={styles.conceptIcon} />
              <TextInput 
                style={styles.conceptInput} 
                placeholder="Añadir concepto (opcional)..." 
                placeholderTextColor="#64748B"
                value={operationConcept}
                onChangeText={setOperationConcept}
                maxLength={35}
              />
            </View>

            {/* --- ESTRATEGIA PREMIUM: AUTOMATIZACIÓN AVANZADA --- */}
            <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={18} color="#C48A76" style={{ marginRight: 8 }} />
                  <View>
                    <Text style={{ color: '#D8D8DA', fontSize: 14, fontWeight: '600' }}>Hacer recurrente</Text>
                    <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>Programa ingresos o pagos fijos</Text>
                  </View>
                </View>
                <Switch 
                  trackColor={{ false: 'rgba(216, 216, 218, 0.1)', true: 'rgba(196, 138, 118, 0.4)' }}
                  thumbColor={isRecurring ? '#C48A76' : '#64748B'}
                  value={isRecurring}
                  onValueChange={(val) => {
                    if (userPlan === 'basic' && val) {
                      if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      setCustomAlert({ 
                        visible: true, 
                        title: 'AUTOMATIZACIÓN MENSUAL', 
                        message: 'Ahorra tiempo programando ingresos o pagos fijos automáticos en tus bóvedas.\n\nMejora tu plan para activarlo.', 
                        type: 'error' 
                      });
                      setIsModalVisible(false);
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setCurrentScreen('Plans');
                    } else {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setIsRecurring(val);
                      if (isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                />
              </View>

              {/* Menú desplegable de configuración de fecha (Diseño 100% Nativo) */}
              {isRecurring && userPlan !== 'basic' && (
                <View style={{ marginTop: 16, backgroundColor: 'rgba(216, 216, 218, 0.03)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.08)' }}>
                  
                  {/* Selector: Semanal vs Mensual */}
                  <View style={{ flexDirection: 'row', backgroundColor: 'rgba(17, 26, 66, 0.5)', borderRadius: 8, padding: 4, marginBottom: 16 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: recurringFreq === 'weekly' ? 'rgba(196, 138, 118, 0.2)' : 'transparent' }}
                      onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setRecurringFreq('weekly'); setRecurringDay(1); if(isHapticEnabled) Haptics.selectionAsync(); }}
                    >
                      <Text style={{ color: recurringFreq === 'weekly' ? '#D8D8DA' : '#64748B', fontSize: 12, fontWeight: '700' }}>SEMANAL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: recurringFreq === 'monthly' ? 'rgba(196, 138, 118, 0.2)' : 'transparent' }}
                      onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setRecurringFreq('monthly'); setRecurringDay(1); if(isHapticEnabled) Haptics.selectionAsync(); }}
                    >
                      <Text style={{ color: recurringFreq === 'monthly' ? '#D8D8DA' : '#64748B', fontSize: 12, fontWeight: '700' }}>MENSUAL</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 }}>
                    {recurringFreq === 'weekly' ? 'DÍA DE LA SEMANA' : 'DÍA DEL MES'}
                  </Text>
                  
                  {/* Selector de días (Semanal horizontal, Mensual en Calendario 7x7) */}
                  {recurringFreq === 'weekly' ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 10 }}>
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, idx) => (
                        <TouchableOpacity 
                          key={day} 
                          style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: recurringDay === idx + 1 ? '#C48A76' : 'rgba(216, 216, 218, 0.1)', backgroundColor: recurringDay === idx + 1 ? 'rgba(196, 138, 118, 0.15)' : 'transparent', marginRight: 8 }}
                          onPress={() => { setRecurringDay(idx + 1); if(isHapticEnabled) Haptics.selectionAsync(); }}
                        >
                          <Text style={{ color: recurringDay === idx + 1 ? '#C48A76' : '#94A3B8', fontWeight: '600', fontSize: 13 }}>{day}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingTop: 4 }}>
                      {Array.from({length: 31}, (_, i) => i + 1).map((day) => (
                        <View key={`day-wrap-${day}`} style={{ width: '14.28%', alignItems: 'center', marginBottom: 12 }}>
                          <TouchableOpacity 
                            style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: recurringDay === day ? '#C48A76' : 'rgba(216, 216, 218, 0.05)', backgroundColor: recurringDay === day ? 'rgba(196, 138, 118, 0.15)' : 'transparent' }}
                            onPress={() => { setRecurringDay(day); if(isHapticEnabled) Haptics.selectionAsync(); }}
                          >
                            <Text style={{ color: recurringDay === day ? '#C48A76' : '#94A3B8', fontWeight: '600', fontSize: 14 }}>{day}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Título sutil para separar el bloque de recurrencia del de billetes */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 12, paddingHorizontal: 16 }}>DESGLOSE DE BILLETES</Text>

            {[500, 200, 100, 50, 20, 10, 5].map((denom) => {
                const count = operationNotes[denom];
                const stock = activeDeposit.banknotes[denom] || 0;
                
                return (
                  <View key={`calc-${denom}`} style={styles.calcRow}>
                    <View style={styles.calcLeft}>
                      {activeDeposit.currencyId === 'EUR' && EURO_IMAGES[denom] && (
                        <Image source={EURO_IMAGES[denom]} style={styles.calcNoteImage} />
                      )}
                      {operationType === 'out' && (
                        <Text style={styles.stockLabel}>Stock: {stock}</Text>
                      )}
                    </View>

                    <View style={styles.calcControls}>
                      <TouchableOpacity style={styles.calcBtn} onPress={() => handleNoteChange(denom, 'sub')}>
                        <Ionicons name="remove" size={20} color="#D8D8DA" />
                      </TouchableOpacity>
                      <Text style={styles.calcCount}>{count}</Text>
                      <TouchableOpacity 
                        style={[styles.calcBtn, operationType === 'out' && count >= stock && styles.calcBtnDisabled]} 
                        onPress={() => handleNoteChange(denom, 'add')}
                        disabled={operationType === 'out' && count >= stock}
                      >
                        <Ionicons name="add" size={20} color="#D8D8DA" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={[styles.confirmBtn, getOperationTotal() === 0 && styles.confirmBtnDisabled]} onPress={confirmOperation}>
              <Text style={styles.confirmBtnText}>CONFIRMAR {operationType === 'in' ? 'INGRESO' : 'RETIRADA'}</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
      {/* --- MODAL PARA CREAR NUEVO DEPÓSITO --- */}
      <Modal animationType="fade" transparent={true} visible={isCreateDepositModalVisible} onRequestClose={() => setIsCreateDepositModalVisible(false)}>
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoModalContent, { backgroundColor: theme.bg, borderColor: theme.cardBorder }]}>
            <View style={styles.infoModalHeader}>
              <Ionicons name="shield-checkmark" size={28} color={theme.accent} />
              <TouchableOpacity onPress={() => setIsCreateDepositModalVisible(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close" size={24} color={theme.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.infoModalTitle, { color: theme.textMain }]}>NUEVA BÓVEDA</Text>
            
            <Text style={[styles.settingsRowLabel, {marginBottom: 16, fontSize: 14, color: theme.textSub}]}>¿Qué divisa alojará este depósito?</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10}}>
              {selectedCurrencies.length === 0 ? (
                <Text style={{color: '#F44336', fontSize: 13}}>Ve a "Mis Divisas" para añadir monedas primero.</Text>
              ) : (
                selectedCurrencies.map(curId => {
                  const c = CURRENCIES.find(x => x.id === curId);
                 return (
                        <TouchableOpacity 
                          key={curId} 
                          style={[styles.notePill, {backgroundColor: 'rgba(196, 138, 118, 0.15)', borderColor: '#C48A76', paddingVertical: 12, paddingHorizontal: 16}]}
                          onPress={() => {
                        const newId = Date.now().toString(); 
                        const newDeposit = {
                          id: newId,
                          name: '',
                          amount: 0, 
                          currencyId: curId, 
                          type: appMode, // 💼 MAGIA: Etiquetamos la bóveda automáticamente
                          banknotes: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 },
                          history: []
                        };
                        
                        setDeposits([...deposits, newDeposit]);
                        setActiveDeposit(newDeposit);
                        setIsCreateDepositModalVisible(false);
                        
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setCurrentScreen('DepositDetail');
                      }}
                    >
                      <Text style={{color: theme.accent, fontWeight: 'bold', fontSize: 16}}>{c.symbol} {c.id}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* --- MODAL PREMIUM: FIJAR META DE AHORRO --- */}
      <Modal animationType="fade" transparent={true} visible={isGoalModalVisible} onRequestClose={() => setIsGoalModalVisible(false)}>
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoModalContent, { paddingBottom: 32 }]}>
            <View style={styles.infoModalHeader}>
              <Ionicons name="flag" size={28} color="#C48A76" />
              <TouchableOpacity onPress={() => setIsGoalModalVisible(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.infoModalTitle}>FIJAR META DE AHORRO</Text>
            
            <Text style={styles.infoModalText}>
              Define tu objetivo económico para la bóveda "{progressData.name}". El gráfico del Dashboard se adaptará en tiempo real.
            </Text>
            
            <View style={[styles.conceptInputWrapper, { borderColor: '#C48A76', borderWidth: 1, backgroundColor: 'rgba(17, 26, 66, 0.8)', height: 60, marginBottom: 30 }]}>
              <Text style={{color: '#C48A76', fontSize: 24, marginRight: 10, fontWeight: 'bold'}}>
                {CURRENCIES.find(c => c.id === progressData.currencyId)?.symbol || '€'}
              </Text>
              <TextInput 
                style={[styles.conceptInput, { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' }]} 
                keyboardType="numeric"
                value={tempGoalInput}
                onChangeText={setTempGoalInput}
                autoFocus={true}
              />
            </View>

            <TouchableOpacity 
              style={[styles.planBtn, { backgroundColor: '#C48A76', width: '100%' }]} 
              activeOpacity={0.9}
              onPress={() => {
                const num = parseFloat(tempGoalInput.replace(/,/g, ''));
                if (!isNaN(num) && num > 0) {
                  setCustomGoals(prev => ({ ...prev, [progressData.id]: num }));
                  if(isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setIsGoalModalVisible(false);
                } else {
                  Alert.alert("Error", "Introduce una cantidad válida.");
                }
              }}
            >
              <Text style={[styles.planBtnText, { color: '#111A42' }]}>GUARDAR OBJETIVO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL INFO BLOQUEO AUTOMÁTICO --- */}
      <Modal animationType="fade" transparent={true} visible={isAutoLockInfoVisible} onRequestClose={() => setIsAutoLockInfoVisible(false)}>
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModalContent}>
            <View style={styles.infoModalHeader}>
              <Ionicons name="information-circle" size={28} color="#C48A76" />
              <TouchableOpacity onPress={() => setIsAutoLockInfoVisible(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.infoModalTitle}>Bloqueo Automático</Text>
            <Text style={styles.infoModalText}>
              Esta función protege tu información si olvidas cerrar la app. {'\n\n'}
              Si cambias a otra aplicación o apagas la pantalla, te volveremos a exigir tu PIN o biometría cuando regreses, respetando el tiempo de tolerancia que elijas.
            </Text>
            <TouchableOpacity style={styles.infoModalBtn} onPress={() => setIsAutoLockInfoVisible(false)}>
              <Text style={styles.infoModalBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    {/* --- MODAL: ONBOARDING DE EQUIPO Y ROLES --- */}
      <Modal 
        animationType="slide" 
        transparent={true} 
        visible={showTeamOnboarding} 
        onRequestClose={() => {
          if (!hasCompletedBusinessSetup) setAppMode('personal');
          setShowTeamOnboarding(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%', paddingBottom: 40, backgroundColor: theme.bg, borderColor: theme.cardBorder }]}>
            
            {/* Header del Modal */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 }}>
              <Text style={{ color: theme.textMain, fontSize: 22, fontWeight: '900' }}>
                {teamSetupStep === 'decision' ? 'Modelo de Trabajo' : teamSetupStep === 'master_pin' ? 'Seguridad Jefe' : teamSetupStep === 'local_setup' ? 'Terminal compartido' : 'Conexión en la nube'}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  if (!hasCompletedBusinessSetup) setAppMode('personal');
                  setShowTeamOnboarding(false);
                }} 
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.cardBg, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="close" size={20} color={theme.textSub} />
                </View>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              
              {/* --- PANTALLA 1: LA DECISIÓN --- */}
              {teamSetupStep === 'decision' && (
                <View style={{ paddingBottom: 20 }}>
                  <Text style={{ color: theme.textSub, fontSize: 15, marginBottom: 24, lineHeight: 22 }}>
                    ¿Cómo van a utilizar tus empleados el sistema TPV en tu negocio? Elige la arquitectura que mejor se adapte a ti.
                  </Text>

                  {/* Tarjeta A: Local */}
                  <TouchableOpacity 
                    style={{ backgroundColor: theme.cardBg, borderWidth: 2, borderColor: teamMode === 'local' ? theme.accent : theme.cardBorder, borderRadius: 20, padding: 20, marginBottom: 16 }}
                    activeOpacity={0.9}
                    onPress={() => {
                      if(isHapticEnabled) Haptics.selectionAsync();
                      setTeamMode('local');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: teamMode === 'local' ? 'rgba(76, 175, 80, 0.2)' : theme.iconBg, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                        <Ionicons name="tablet-portrait" size={24} color={teamMode === 'local' ? theme.accent : theme.textMain} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.textMain, fontSize: 16, fontWeight: '800', marginBottom: 2 }}>Terminal Compartido</Text>
                        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>RECOMENDADO PARA COMERCIOS</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.textSub, fontSize: 13, lineHeight: 18 }}>
                      Un solo dispositivo en el mostrador para todos. Protegido por PIN individual. La app sabrá quién está cobrando en todo momento.
                    </Text>
                  </TouchableOpacity>

                  {/* Tarjeta B: Nube */}
                  <TouchableOpacity 
                    style={{ backgroundColor: theme.cardBg, borderWidth: 2, borderColor: teamMode === 'cloud' ? '#2196F3' : theme.cardBorder, borderRadius: 20, padding: 20, marginBottom: 30 }}
                    activeOpacity={0.9}
                    onPress={() => {
                      if(isHapticEnabled) Haptics.selectionAsync();
                      setTeamMode('cloud');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: teamMode === 'cloud' ? 'rgba(33, 150, 243, 0.2)' : theme.iconBg, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                        <Ionicons name="cloud-done" size={24} color={teamMode === 'cloud' ? '#2196F3' : theme.textMain} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.textMain, fontSize: 16, fontWeight: '800', marginBottom: 2 }}>Multidispositivos</Text>
                        <Text style={{ color: '#2196F3', fontSize: 12, fontWeight: '700' }}>MODO NUBE ACTIVO</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.textSub, fontSize: 13, lineHeight: 18 }}>
                      Cada empleado usa su propio teléfono personal. Genera invitaciones y vincúlalos a tu bóveda remota.
                    </Text>
                  </TouchableOpacity>

                  {/* Botón Continuar */}
                  <TouchableOpacity 
                    style={{ width: '100%', backgroundColor: teamMode ? theme.accent : theme.cardBg, borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', opacity: teamMode ? 1 : 0.5 }}
                    disabled={!teamMode}
                    activeOpacity={0.8}
                    onPress={() => {
                      if(isHapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      
                      // Magia Arquitectónica: Le enviamos a crear su llave maestra primero
                      setTeamSetupStep('master_pin'); 
                      setMasterPin('');
                      setTempMasterPin('');
                    }}
                  >
                    <Text style={{ color: teamMode ? '#FFFFFF' : theme.textSub, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>CONFIGURAR ENTORNO</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* --- PANTALLA 1.5: PIN MAESTRO (EL ESCUDO) --- */}
              {teamSetupStep === 'master_pin' && (
                <View style={{ paddingBottom: 20, alignItems: 'center' }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                    <Ionicons name="key" size={32} color={theme.accent} />
                  </View>
                  <Text style={{ color: theme.textMain, fontSize: 22, fontWeight: '800', marginBottom: 12 }}>Tu Llave Maestra</Text>
                  <Text style={{ color: theme.textSub, fontSize: 14, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20, lineHeight: 20 }}>
                    {tempMasterPin.length === 0 && !masterPin
                      ? "Crea un PIN de 4 dígitos. Esta será tu llave exclusiva como Dueño para acceder a gráficas y ajustes."
                      : "Repite tu PIN de 4 dígitos para confirmar."}
                  </Text>

                  {/* Puntos visuales del PIN */}
                  <View style={{ flexDirection: 'row', marginBottom: 40 }}>
                     {[0, 1, 2, 3].map((i) => (
                       <View 
                         key={i} 
                         style={{ 
                           width: 16, 
                           height: 16, 
                           borderRadius: 8, 
                           backgroundColor: (tempMasterPin.length > i || (masterPin && tempMasterPin === '')) ? theme.accent : 'rgba(216, 216, 218, 0.2)', 
                           marginHorizontal: 12 
                         }} 
                       />
                     ))}
                  </View>

                  {/* Teclado Nativo Dopamínico */}
                  <View style={{ width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, idx) => (
                      <TouchableOpacity 
                        key={idx}
                        disabled={key === ''}
                        style={{ 
                          width: 75, height: 75, margin: 8, borderRadius: 37.5, 
                          backgroundColor: key !== 'del' && key !== '' ? 'rgba(216,216,218,0.05)' : 'transparent', 
                          justifyContent: 'center', alignItems: 'center' 
                        }}
                        onPress={() => {
                          if (key === 'del') {
                            setTempMasterPin(prev => prev.slice(0, -1));
                          } else if (key !== '') {
                            const newPin = tempMasterPin + key;
                            setTempMasterPin(newPin);
                            
                            if (newPin.length === 4) {
                               setTimeout(() => {
                                 if (masterPin === '') {
                                    setMasterPin(newPin);
                                    setTempMasterPin('');
                                 } else {
                                    if (newPin === masterPin) {
                                       // PIN Confirmado: ¡Avanzamos a la siguiente fase!
                                       LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                       setTeamSetupStep(teamMode === 'local' ? 'local_setup' : 'cloud_setup');
                                       if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    } else {
                                       // Error de PIN
                                       if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                       setCustomAlert({ visible: true, title: 'Error', message: 'Los PINs no coinciden. Vuelve a intentarlo.', type: 'error' });
                                       setMasterPin('');
                                       setTempMasterPin('');
                                    }
                                 }
                               }, 300); // 300ms de retraso para que vea el cuarto punto llenarse
                            }
                          }
                        }}
                      >
                        {key === 'del' ? <Ionicons name="backspace-outline" size={28} color={theme.textMain} /> : <Text style={{ color: theme.textMain, fontSize: 30, fontWeight: '500' }}>{key}</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* --- PANTALLA 2A: RUTA LOCAL (CREAR PIN) --- */}
              {teamSetupStep === 'local_setup' && (
                <View style={{ paddingBottom: 20 }}>
                  <Text style={{ color: theme.textSub, fontSize: 14, marginBottom: 24, lineHeight: 20 }}>
                    Añade a tus empleados y asígnales un PIN de 4 dígitos. Lo usarán para desbloquear el terminal en Modo TPV.
                  </Text>

                  {/* Formulario Añadir */}
                  <View style={{ backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder, borderRadius: 20, padding: 20, marginBottom: 24 }}>
                    <Text style={{ color: theme.textMain, fontSize: 13, fontWeight: '800', marginBottom: 8, marginLeft: 4 }}>Nombre del Empleado</Text>
                    <TextInput
                      style={{ backgroundColor: theme.bg, color: theme.textMain, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.cardBorder, outlineStyle: 'none' }}
                      placeholder="Ej. Marcos"
                      placeholderTextColor={theme.textSub}
                      value={newEmpName}
                      onChangeText={setNewEmpName}
                    />

                    <Text style={{ color: theme.textMain, fontSize: 13, fontWeight: '800', marginBottom: 8, marginLeft: 4 }}>PIN de Acceso (4 dígitos)</Text>
                    <TextInput
                      style={{ backgroundColor: theme.bg, color: theme.accent, borderRadius: 12, padding: 16, fontSize: 24, fontWeight: 'bold', letterSpacing: 8, marginBottom: 20, borderWidth: 1, borderColor: theme.cardBorder, outlineStyle: 'none', textAlign: 'center' }}
                      placeholder="••••"
                      placeholderTextColor={theme.textSub}
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry={true}
                      value={newEmpPin}
                      onChangeText={(val) => setNewEmpPin(val.replace(/[^0-9]/g, ''))}
                    />

                    <TouchableOpacity 
                      style={{ backgroundColor: (newEmpName && newEmpPin.length === 4) ? theme.accent : theme.iconBg, borderRadius: 12, height: 50, justifyContent: 'center', alignItems: 'center' }}
                      disabled={!newEmpName || newEmpPin.length < 4}
                      onPress={() => {
                        if(isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setEmployees([...employees, { id: Date.now().toString(), name: newEmpName, pin: newEmpPin, role: 'employee' }]);
                        setNewEmpName('');
                        setNewEmpPin('');
                      }}
                    >
                      <Text style={{ color: (newEmpName && newEmpPin.length === 4) ? '#FFF' : theme.textSub, fontWeight: 'bold' }}>+ AÑADIR AL EQUIPO</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Lista de Empleados */}
                  <Text style={{ color: theme.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>EQUIPO ACTUAL</Text>
                  {employees.length === 0 ? (
                     <Text style={{ color: theme.textSub, fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 10 }}>No hay empleados registrados.</Text>
                  ) : (
                    employees.map((emp) => (
                      <View key={emp.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.cardBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.iconBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                            <Ionicons name="person" size={16} color={theme.accent} />
                          </View>
                          <View>
                            <Text style={{ color: theme.textMain, fontWeight: 'bold', fontSize: 15 }}>{emp.name}</Text>
                            <Text style={{ color: theme.textSub, fontSize: 11 }}>Rol: TPV Restringido</Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => setEmployees(employees.filter(e => e.id !== emp.id))}>
                          <Ionicons name="trash-outline" size={20} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* --- PANTALLA 2B: RUTA NUBE (INVITACIÓN) --- */}
              {teamSetupStep === 'cloud_setup' && (
                <View style={{ alignItems: 'center', paddingBottom: 20 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(33, 150, 243, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                    <Ionicons name="cloud-upload" size={32} color="#2196F3" />
                  </View>
                  <Text style={{ color: theme.textMain, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Vincular Nuevo Dispositivo</Text>
                  <Text style={{ color: theme.textSub, fontSize: 14, textAlign: 'center', marginBottom: 30, lineHeight: 20, paddingHorizontal: 10 }}>
                    Pide a tu empleado que descargue SUELTO. En la pantalla de inicio, debe seleccionar "Conectar como Empleado" e introducir este código seguro:
                  </Text>

                  {/* Código Falso (Placeholder UX) */}
                  <View style={{ backgroundColor: theme.cardBg, borderWidth: 1, borderColor: '#2196F3', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', marginBottom: 30, borderStyle: 'dashed' }}>
                    <Text style={{ color: '#2196F3', fontSize: 28, fontWeight: '900', letterSpacing: 4 }}>BUS-849X</Text>
                  </View>

                  <View style={{ width: 180, height: 180, backgroundColor: '#FFF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                    <Ionicons name="qr-code" size={140} color="#000" />
                  </View>
                  
                  <Text style={{ color: theme.textSub, fontSize: 12, textAlign: 'center' }}>Esperando conexión desde el dispositivo cliente...</Text>
                </View>
              )}

            {/* Botón Finalizar Configuración (Aparece en ambas rutas tras el PIN Maestro) */}
              {(teamSetupStep === 'local_setup' || teamSetupStep === 'cloud_setup') && (
                <TouchableOpacity 
                  style={{ 
                    width: '100%', 
                    backgroundColor: theme.accent, 
                    borderRadius: 16, 
                    height: 56, 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    marginTop: 20, 
                    marginBottom: 10 
                  }}
                  activeOpacity={0.8}
                  onPress={() => {
                    if(isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setHasCompletedBusinessSetup(true); // ¡Setup 100% completado!
                    setShowTeamOnboarding(false);
                    setAppMode('business');
                    setCurrentUser({ name: finalUserName, role: 'admin' });
                  }}
                >
                  <Text style={{ color: theme.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                    FINALIZAR CONFIGURACIÓN
                  </Text>
                </TouchableOpacity>
              )}  

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL TPV: QUICK ACTION --- */}
      <Modal animationType="slide" transparent={true} visible={isQuickActionVisible} onRequestClose={() => setIsQuickActionVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', paddingBottom: 40, backgroundColor: theme.bg, borderColor: theme.cardBorder }]}>
            
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: quickActionType === 'sale' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name={quickActionType === 'sale' ? "arrow-up" : "arrow-down"} size={20} color={quickActionType === 'sale' ? "#4CAF50" : "#F44336"} />
                </View>
                <Text style={{ color: theme.textMain, fontSize: 18, fontWeight: '800' }}>
                  {quickActionType === 'sale' ? 'NUEVA VENTA' : 'NUEVO PAGO'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsQuickActionVisible(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close-circle" size={28} color={theme.textSub} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.textSub, fontSize: 14, marginBottom: 20 }}>
              {quickActionType === 'sale' ? 'Introduce el importe cobrado en efectivo:' : 'Introduce el importe pagado con dinero de la caja:'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.cardBg, borderWidth: 1, borderColor: quickActionAmount ? (quickActionType === 'sale' ? '#4CAF50' : '#F44336') : theme.cardBorder, borderRadius: 20, paddingHorizontal: 20, height: 80, marginBottom: 30 }}>
              <Text style={{ color: quickActionType === 'sale' ? '#4CAF50' : '#F44336', fontSize: 32, fontWeight: '900', marginRight: 16 }}>
                {CURRENCIES.find(c => c.id === (activeDeposits[0]?.currencyId || 'EUR'))?.symbol || '€'}
              </Text>
              <TextInput
                style={{ flex: 1, color: theme.textMain, fontSize: 38, fontWeight: 'bold', height: '100%', outlineStyle: 'none', padding: 0, margin: 0 }}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={theme.textSub}
                value={quickActionAmount}
                onChangeText={(val) => setQuickActionAmount(val.replace(/[^0-9.]/g, ''))}
                autoFocus={true}
                selectionColor={quickActionType === 'sale' ? '#4CAF50' : '#F44336'}
              />
            </View>

            <TouchableOpacity 
              style={{ 
                width: '100%', 
                backgroundColor: quickActionAmount ? (quickActionType === 'sale' ? '#4CAF50' : '#F44336') : theme.cardBg, 
                borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center',
                borderWidth: quickActionAmount ? 0 : 1, borderColor: theme.cardBorder 
              }}
              disabled={!quickActionAmount}
              activeOpacity={0.8}
              onPress={() => {
                const amount = parseFloat(quickActionAmount || 0);
                if (amount > 0) {
                  if (quickActionType === 'sale') {
                    setRegisterSales(prev => prev + amount);
                  } else {
                    setRegisterExpenses(prev => prev + amount);
                  }

                  // 🕵️‍♂️ AUDITORÍA: Fichamos quién hace el movimiento exacto
                  const now = new Date();
                  setRegisterLog(prev => [...prev, {
                    id: Date.now().toString(),
                    type: quickActionType,
                    amount: amount,
                    user: currentUser.name,
                    time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
                  }]);
                  
                  if (isHapticEnabled) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 200);
                  }
                  
                  setIsQuickActionVisible(false);
                  
                  // Pequeño guiño de dopamina visual (lanzamos el overlay con animación corta)
                  setAnimType(quickActionType === 'sale' ? 'in' : 'out');
                  setShowSuccessAnim(true);
                  Animated.spring(popAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
                  setTimeout(() => {
                    Animated.timing(popAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setShowSuccessAnim(false));
                  }, 1200);
                }
              }}
            >
              <Text style={{ color: quickActionAmount ? '#FFFFFF' : theme.textSub, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                {quickActionAmount ? 'REGISTRAR OPERACIÓN' : 'INTRODUCE IMPORTE'}
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* --- MODAL DE ALERTA PREMIUM --- */}
      <Modal animationType="fade" transparent={true} visible={customAlert.visible} onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoModalContent, { alignItems: 'center', paddingVertical: 32 }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: customAlert.type === 'success' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name={customAlert.type === 'success' ? "checkmark-circle" : "close-circle"} size={40} color={customAlert.type === 'success' ? "#4CAF50" : "#F44336"} />
            </View>
            <Text style={[styles.infoModalTitle, { textAlign: 'center', marginBottom: 16 }]}>{customAlert.title}</Text>
            
            {/* ScrollView inyectado para soportar los tickets largos de auditoría */}
            <ScrollView style={{ maxHeight: 220, width: '100%', marginBottom: 24 }} showsVerticalScrollIndicator={true}>
               <Text style={[styles.infoModalText, { textAlign: 'left', marginBottom: 0 }]}>{customAlert.message}</Text>
            </ScrollView>
            
            <TouchableOpacity 
              style={[styles.infoModalBtn, { width: '100%', backgroundColor: customAlert.type === 'success' ? '#4CAF50' : '#F44336', borderColor: customAlert.type === 'success' ? '#4CAF50' : '#F44336' }]} 
              onPress={() => setCustomAlert({ ...customAlert, visible: false })}
            >
              <Text style={[styles.infoModalBtnText, { color: '#FFFFFF' }]}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- OVERLAY DE DOPAMINA NATIVO (EXPANDIDO) --- */}
      {showSuccessAnim && (() => {
        // Configuramos la interfaz según el tipo de animación
        let animConfig = { color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.2)', emoji: '💸', text: '+ INGRESADO' };
        if (animType === 'out') animConfig = { color: '#F44336', bg: 'rgba(244, 67, 54, 0.2)', emoji: '💸', text: '- RETIRADO' };
        if (animType === 'perfect_close') animConfig = { color: '#059669', bg: 'rgba(5, 150, 105, 0.2)', emoji: '🏆', text: '¡CIERRE PERFECTO!' };
        if (animType === 'warning_close') animConfig = { color: '#F97316', bg: 'rgba(249, 115, 22, 0.2)', emoji: '⚠️', text: 'CAJA CON DESCUADRE' };
        if (animType === 'blind_close') animConfig = { color: '#059669', bg: 'rgba(5, 150, 105, 0.2)', emoji: '🔒', text: 'TURNO CERRADO' };

        return (
          <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', zIndex: 9999, backgroundColor: 'rgba(17, 26, 66, 0.92)' }]}>
            <Animated.View style={{ 
              alignItems: 'center',
              transform: [{ scale: popAnim }],
              opacity: popAnim
            }}>
              <View style={{
                width: 140, height: 140, borderRadius: 70,
                backgroundColor: animConfig.bg,
                justifyContent: 'center', alignItems: 'center',
                borderWidth: 4, borderColor: animConfig.color,
                marginBottom: 24,
                // Efecto "Glow" Brillante Dopamínico
                shadowColor: animConfig.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 30, elevation: 15
              }}>
                <Text style={{ fontSize: 70, textAlign: 'center', includeFontPadding: false }}>
                  {animConfig.emoji}
                </Text>
              </View>
              <Text style={{
                color: animConfig.color, 
                fontSize: 28, 
                fontWeight: '900', 
                letterSpacing: 1.5,
                textAlign: 'center'
              }}>
                {animConfig.text}
              </Text>
            </Animated.View>
          </View>
        );
      })()}
      {/* --- OVERLAY NATIVO DE BLOQUEO / CREACIÓN DE PIN (RESTAURADO) --- */}
      {(lockMode === 'setup' || lockMode === 'panic-setup' || lockMode === 'unlock') && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111A42', zIndex: 9998, justifyContent: 'center', alignItems: 'center' }]}>
          <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            
            <Ionicons name={lockMode === 'unlock' ? "lock-closed" : "keypad"} size={45} color="#C48A76" style={{ marginBottom: 20 }} />
            
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 }}>
              {lockMode === 'setup' ? 'CREAR PIN' : lockMode === 'panic-setup' ? 'PIN DE PÁNICO' : 'INTRODUCE TU PIN'}
            </Text>
            
            <Text style={{ color: '#64748B', fontSize: 14, marginBottom: 40 }}>
              {lockMode === 'setup' ? 'Protege el acceso a tu dinero' : lockMode === 'panic-setup' ? 'Este PIN simulará una app vacía' : 'Desbloquea para continuar'}
            </Text>

            {/* Puntos del PIN (Indicadores visuales) */}
            <View style={{ flexDirection: 'row', marginBottom: 50 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ 
                  width: 16, height: 16, borderRadius: 8, 
                  backgroundColor: enteredPin.length > i ? '#C48A76' : 'rgba(196, 138, 118, 0.2)', 
                  marginHorizontal: 12 
                }} />
              ))}
            </View>

            {/* Teclado Numérico Premium */}
            <View style={{ width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'].map((key) => (
                <TouchableOpacity
                  key={key}
                  style={{ 
                    width: 75, height: 75, margin: 8, borderRadius: 37.5, 
                    backgroundColor: key !== 'bio' && key !== 'del' ? 'rgba(255,255,255,0.05)' : 'transparent', 
                    justifyContent: 'center', alignItems: 'center' 
                  }}
                  onPress={() => {
                    if (key === 'del') {
                      setEnteredPin(prev => prev.slice(0, -1));
                    } else if (key === 'bio') {
                      if (lockMode === 'unlock' && isBiometricEnabled) handleBiometricAuth();
                    } else {
                      const newPin = enteredPin + key;
                      setEnteredPin(newPin);
                      
                      // Lógica al llegar al 4º dígito
                      if (newPin.length === 4) {
                        setTimeout(() => {
                          if (lockMode === 'setup') {
                            setUserPin(newPin);
                            setIsPinEnabled(true);
                            setLockMode(null);
                          } else if (lockMode === 'panic-setup') {
                            try { setPanicPin(newPin); } catch(e){}
                            setLockMode(null);
                          } else if (lockMode === 'unlock') {
                            if (newPin === userPin) {
                              setLockMode(null);
                            } else {
                              try { if (newPin === panicPin) { setLockMode(null); } } catch(e){}
                              setEnteredPin('');
                            }
                          }
                          setEnteredPin('');
                        }, 250); // Pequeño retraso para que se vea el 4º punto pintado
                      }
                    }
                  }}
                >
                  {key === 'del' ? <Ionicons name="backspace-outline" size={28} color="#D8D8DA" /> :
                   key === 'bio' ? (lockMode === 'unlock' && isBiometricEnabled ? <Ionicons name="fingerprint" size={32} color="#C48A76" /> : null) :
                   <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '500' }}>{key}</Text>}
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Botón de Cancelar para configuraciones */}
            {(lockMode === 'setup' || lockMode === 'panic-setup') && (
              <TouchableOpacity 
                style={{ marginTop: 30, padding: 10 }}
                onPress={() => {
                  setLockMode(null);
                  setEnteredPin('');
                  if (lockMode === 'setup') setIsPinEnabled(false);
                }}
              >
                <Text style={{ color: '#F44336', fontSize: 16, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            )}
            
          </SafeAreaView>
        </View>
      )}

      {/* --- GATEKEEPER: TECLADO TPV DE ACCESO --- */}
      {showGatekeeper && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0F172A', zIndex: 9998, justifyContent: 'center', alignItems: 'center' }]}>
          <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="keypad" size={50} color="#059669" style={{ marginBottom: 24 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 1, marginBottom: 12 }}>SISTEMA TPV</Text>
            <Text style={{ color: '#94A3B8', fontSize: 15, textAlign: 'center', paddingHorizontal: 40, marginBottom: 30 }}>
              Introduce tu código personal para acceder a la caja o desbloquear el terminal.
            </Text>

            {/* Puntos de progreso del PIN */}
            <View style={{ flexDirection: 'row', marginBottom: 50 }}>
              {[0, 1, 2, 3].map((i) => (
                <View 
                  key={i} 
                  style={{ 
                    width: 18, 
                    height: 18, 
                    borderRadius: 9, 
                    backgroundColor: gatekeeperPin.length > i ? '#059669' : 'rgba(5, 150, 105, 0.2)', 
                    marginHorizontal: 12 
                  }} 
                />
              ))}
            </View>

            {/* Teclado Inteligente */}
            <View style={{ width: 300, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'exit', '0', 'del'].map((key, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{ 
                    width: 75, 
                    height: 75, 
                    margin: 10, 
                    borderRadius: 37.5, 
                    backgroundColor: key !== 'exit' && key !== 'del' ? 'rgba(255,255,255,0.05)' : 'transparent', 
                    justifyContent: 'center', 
                    alignItems: 'center' 
                  }}
                  onPress={() => {
                    if (key === 'del') {
                      setGatekeeperPin(prev => prev.slice(0, -1));
                    } else if (key === 'exit') {
                      // Abortar y volver a Modo Personal
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setAppMode('personal');
                      setCurrentUser({ name: finalUserName, role: 'admin' });
                      setShowGatekeeper(false);
                      setGatekeeperPin('');
                    } else {
                      const newPin = gatekeeperPin + key;
                      setGatekeeperPin(newPin);
                      
                      // Magia deductiva en el 4to dígito
                      if (newPin.length === 4) {
                        setTimeout(() => {
                          if (newPin === masterPin) {
                            // Jefe detectado
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setAppMode('business');
                            setCurrentUser({ name: finalUserName, role: 'admin' });
                            setShowGatekeeper(false);
                            if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          } else {
                            // Buscar Empleado
                            const emp = employees.find(e => e.pin === newPin);
                            if (emp) {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setAppMode('business');
                              setCurrentUser({ name: emp.name, role: 'employee' });
                              setShowGatekeeper(false);
                              if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } else {
                              // PIN Inválido
                              if (isHapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                              setCustomAlert({ visible: true, title: 'Acceso Denegado', message: 'PIN incorrecto o no registrado en el sistema.', type: 'error' });
                            }
                          }
                          setGatekeeperPin('');
                        }, 250); // Pequeño delay de dopamina para ver el último punto encenderse
                      }
                    }
                  }}
                >
                  {key === 'del' ? <Ionicons name="backspace-outline" size={30} color="#D8D8DA" /> :
                   key === 'exit' ? <Ionicons name="close-circle-outline" size={36} color="#F44336" /> :
                   <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '600' }}>{key}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </SafeAreaView>
        </View>
      )}

      </SafeAreaView>

      {/* SPLASH SCREEN */}
      {!appReady && (
        <SplashOverlay fadeAnim={fadeAnim} onFinished={() => setAppReady(true)} />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  mainWrapperDark: { backgroundColor: '#111A42' }, 
  splashScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#12264C', zIndex: 9999, elevation: 9999 },
  safeArea: { flex: 1 },
  
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  smallLogo: { width: 90, height: 70, marginBottom: 10, borderRadius: 16 },
  appName: { fontSize: 28, fontWeight: '800', color: '#12264C', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: '#64748B', marginTop: 8 },
  formContainer: { width: '100%' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, marginBottom: 16, paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#12264C' },
  termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, borderColor: '#94A3B8', borderRadius: 6, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#12264C', borderColor: '#12264C' },
  termsText: { flex: 1, fontSize: 13, color: '#64748B', lineHeight: 18 },
  termsLink: { color: '#D4A387', fontWeight: 'bold' },
  primaryButton: { backgroundColor: '#12264C', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#12264C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  socialContainer: { marginTop: 32, alignItems: 'center' },
  socialText: { fontSize: 14, color: '#94A3B8', marginBottom: 16 },
  socialButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '60%' },
  socialButton: { width: 50, height: 50, backgroundColor: '#FFFFFF', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  footerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: '#64748B', fontSize: 15 },
  footerLink: { color: '#D4A387', fontSize: 15, fontWeight: '700' },

  currencyContainer: { flex: 1, paddingTop: 20 },
  currencyHeader: { paddingHorizontal: 24, marginBottom: 24, marginTop: 20 },
  currencyTitle: { fontSize: 26, fontWeight: '800', color: '#D8D8DA', marginBottom: 8, lineHeight: 32 },
  currencySubtitle: { fontSize: 15, color: '#C48A76', lineHeight: 22 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 100, justifyContent: 'space-between' },
  currencyCard: { width: '47%', backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: 'rgba(216, 216, 218, 0.1)', alignItems: 'center', justifyContent: 'center' },
  currencyCardSelected: { backgroundColor: 'rgba(196, 138, 118, 0.15)', borderColor: '#C48A76' },
  currencySymbol: { fontSize: 32, fontWeight: '600', color: '#D8D8DA', marginBottom: 8 },
  currencyCode: { fontSize: 18, fontWeight: '700', color: '#D8D8DA', marginBottom: 4 },
  currencyName: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  textSelected: { color: '#C48A76' }, 
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 24, backgroundColor: 'rgba(17, 26, 66, 0.95)', borderTopWidth: 1, borderTopColor: 'rgba(216, 216, 218, 0.1)' },
  continueButton: { backgroundColor: '#C48A76', borderRadius: 16, height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#C48A76', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  continueButtonDisabled: { backgroundColor: 'rgba(216, 216, 218, 0.1)', shadowOpacity: 0, elevation: 0 },
  continueButtonText: { color: '#111A42', fontSize: 16, fontWeight: '800' },

  dashboardContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 20 }, 
  dashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  dashGreeting: { fontSize: 16, color: '#94A3B8', marginBottom: 4 },
  dashTitle: { fontSize: 26, fontWeight: '800', color: '#D8D8DA', letterSpacing: 0.5 },
  avatarBtn: { position: 'relative' },
  avatarImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#C48A76' },
  avatarBadge: { position: 'absolute', bottom: -4, right: -4, width: 26, height: 26, backgroundColor: '#C48A76', borderRadius: 13, borderWidth: 2, borderColor: '#111A42', justifyContent: 'center', alignItems: 'center' },
  
  premiumCard: { backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(196, 138, 118, 0.2)', marginBottom: 12 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  balanceLabel: { fontSize: 15, color: '#94A3B8', fontWeight: '500' },
  balanceAmount: { fontSize: 40, fontWeight: '800', color: '#D8D8DA', letterSpacing: 2, marginBottom: 20 },
  currenciesRow: { backgroundColor: 'rgba(17, 26, 66, 0.5)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  currenciesText: { color: '#C48A76', fontSize: 13, fontWeight: '700' },

  bentoContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  bentoMain: { width: '62%', backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', justifyContent: 'space-between', height: 160 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#D8D8DA', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  bentoMainTitle: { fontSize: 18, fontWeight: '700', color: '#D8D8DA', marginBottom: 4 },
  bentoSub: { fontSize: 13, color: '#94A3B8' },
  
  bentoSecondary: { width: '34%', backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', alignItems: 'center', justifyContent: 'center', height: 160 },
  bentoSecTitle: { fontSize: 16, fontWeight: '600', color: '#D8D8DA' },

  dashBottom: { paddingBottom: Platform.OS === 'ios' ? 34 : 24, paddingTop: 12, alignItems: 'center', width: '100%', backgroundColor: '#111A42' },
  upgradeBtn: { width: '100%', backgroundColor: '#C48A76', borderRadius: 16, marginBottom: 14, shadowColor: '#C48A76', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8 },
  upgradeBtnInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  upgradeIconBox: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#111A42', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  upgradeTextCol: { flex: 1 },
  upgradeBtnText: { color: '#111A42', fontSize: 15, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  upgradeBtnSub: { color: 'rgba(17, 26, 66, 0.7)', fontSize: 11, fontWeight: '700' },
  slogan: { fontSize: 13, fontStyle: 'italic', color: '#94A3B8', textAlign: 'center' },

  depositsContainer: { flex: 1, paddingTop: 20 },
  depositsHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 28, marginTop: 16 },
  backArrowBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(216, 216, 218, 0.05)', borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  depositsTitle: { fontSize: 22, fontWeight: '800', color: '#D8D8DA', letterSpacing: 1.5 },
  depositsListScroll: { paddingHorizontal: 24, paddingBottom: 120 },
  depositCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)' },
  depositCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 },
  depositIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#C48A76', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  depositName: { fontSize: 16, fontWeight: '600', color: '#D8D8DA', flex: 1 },
  depositBalance: { fontSize: 18, fontWeight: '700', color: '#C48A76' },
  bottomBarDeposits: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 24, backgroundColor: 'rgba(17, 26, 66, 0.95)', borderTopWidth: 1, borderTopColor: 'rgba(216, 216, 218, 0.1)' },
  createDepositButton: { backgroundColor: '#C48A76', borderRadius: 16, height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#C48A76', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  createDepositButtonText: { color: '#111A42', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  detailContainer: { flex: 1 },
  detailTitleWrapper: { alignItems: 'center', marginTop: 10, paddingHorizontal: 24, marginBottom: 30 },
  detailTitleInput: { fontSize: 26, fontWeight: '800', color: '#D8D8DA', textAlign: 'center', paddingBottom: 8 },
  titleUnderline: { width: '80%', height: 2, backgroundColor: '#C48A76', borderRadius: 2 },
  balanceSection: { paddingHorizontal: 24, marginBottom: 30 },
  balanceMiniLabel: { fontSize: 14, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 4 },
  balanceBigAmount: { fontSize: 44, fontWeight: '800', color: '#D8D8DA', letterSpacing: 1 },
  balanceCurrency: { fontSize: 32, color: '#C48A76' },
  notesSection: { paddingHorizontal: 24, marginBottom: 20 },
  notesSectionTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 16 },
  notesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  notePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(216, 216, 218, 0.05)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)' },
  noteMultiplier: { color: '#D8D8DA', fontWeight: '700', fontSize: 16, marginRight: 8 },
  noteImageBig: { width: 50, height: 28, resizeMode: 'contain', borderRadius: 4 },
  noteFallback: { width: 50, height: 28, backgroundColor: '#12264C', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  noteFallbackText: { color: '#C48A76', fontSize: 12, fontWeight: 'bold' },
  historyScroll: { paddingHorizontal: 24, paddingBottom: 130 },
  historyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(17, 26, 66, 0.5)', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.05)' },
  historyLeft: { flexDirection: 'row', alignItems: 'center' },
  historyIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  historyIn: { backgroundColor: 'rgba(76, 175, 80, 0.15)' },
  historyOut: { backgroundColor: 'rgba(244, 67, 54, 0.15)' },
  historyAmount: { fontSize: 16, fontWeight: '700' },
  historyBalanceAfter: { fontSize: 12, color: '#64748B', marginTop: 2 },
  historyNotesCol: { alignItems: 'flex-end' },
  historyMiniNoteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  historyMiniNoteText: { color: '#94A3B8', fontSize: 13, fontWeight: '600', marginRight: 6 },
  noteImageMini: { width: 32, height: 18, resizeMode: 'contain', borderRadius: 2 },
  historyHeader: { paddingHorizontal: 24, marginTop: 10, marginBottom: 16 },
  historySectionTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 },
  historyDivider: { width: '100%', height: 1, backgroundColor: 'rgba(216, 216, 218, 0.1)' },
  historyDate: { fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17, 26, 66, 0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111A42', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, height: '80%', borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  toggleContainer: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 12, padding: 4, marginRight: 16 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleBtnIn: { backgroundColor: 'rgba(76, 175, 80, 0.2)' },
  toggleBtnOut: { backgroundColor: 'rgba(244, 67, 54, 0.2)' },
  toggleText: { color: '#64748B', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  toggleTextActive: { color: '#D8D8DA' },
  operationTotalBox: { alignItems: 'center', backgroundColor: 'rgba(216, 216, 218, 0.03)', paddingVertical: 16, borderRadius: 16, marginBottom: 20 },
  operationTotalLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  operationTotalAmount: { fontSize: 32, fontWeight: '800' },
  modalScroll: { flex: 1, marginBottom: 20 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 45, borderBottomWidth: 1, borderBottomColor: 'rgba(216, 216, 218, 0.05)' },
  calcLeft: { alignItems: 'flex-start' },
  calcNoteImage: { width: 60, height: 34, resizeMode: 'contain', borderRadius: 4 },
  stockLabel: { fontSize: 10, color: '#C48A76', marginTop: 4, fontWeight: 'bold' },
  calcControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 12, padding: 4 },
  calcBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(17, 26, 66, 0.5)', borderRadius: 8 },
  calcBtnDisabled: { opacity: 0.3 },
  calcCount: { width: 30, textAlign: 'center', color: '#D8D8DA', fontSize: 16, fontWeight: '700' },
  confirmBtn: { backgroundColor: '#C48A76', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: '#64748B', opacity: 0.5 },
  confirmBtnText: { color: '#111A42', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  conceptInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 12, paddingHorizontal: 16, height: 50, marginBottom: 20 },
  conceptIcon: { marginRight: 10 },
  conceptInput: { flex: 1, color: '#D8D8DA', fontSize: 15 },
  historyConcept: { color: '#D8D8DA', fontSize: 14, fontWeight: '700', marginBottom: 2, letterSpacing: 0.2 },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  settingsMenu: { position: 'absolute', top: 90, right: 24, width: 280, backgroundColor: 'rgba(17, 26, 66, 0.98)', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(196, 138, 118, 0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 15 }, 
  settingsBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12 }, 
  settingsIcon: { marginRight: 16 }, 
  settingsBtnText: { color: '#D8D8DA', fontSize: 17, fontWeight: '500', letterSpacing: 0.3 }, 
  settingsDivider: { height: 1, backgroundColor: 'rgba(216, 216, 218, 0.1)', marginVertical: 6, marginHorizontal: 12 },
  settingsLogoutText: { color: '#C62828', fontWeight: '700' },

  settingsScreenContainer: { flex: 1, backgroundColor: '#111A42', paddingTop: 20 },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 24, marginBottom: 30 },
  settingsBackBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(216, 216, 218, 0.05)', borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', justifyContent: 'center', alignItems: 'center' },
  settingsMainTitle: { fontSize: 20, fontWeight: '800', color: '#D8D8DA', letterSpacing: 1.5 },
  settingsHeaderSpacer: { width: 42, height: 42 },
  settingsScroll: { paddingHorizontal: 24, paddingBottom: 60 },
  settingsSectionTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4, marginTop: 16 },
  settingsBlock: { backgroundColor: 'rgba(216, 216, 218, 0.03)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.08)', marginBottom: 16 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  settingsRowLabel: { fontSize: 16, color: '#D8D8DA', fontWeight: '500' },
  settingsTextInput: { fontSize: 16, color: '#C48A76', fontWeight: '700', textAlign: 'right', minWidth: 120 },
  settingsDividerInternal: { height: 1, backgroundColor: 'rgba(216, 216, 218, 0.05)', width: '100%' },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111A42', zIndex: 1000, elevation: 1000, justifyContent: 'center', alignItems: 'center', padding: 24 },
  lockHeader: { alignItems: 'center', marginBottom: 50, marginTop: 20 },
  lockTitle: { fontSize: 24, fontWeight: '800', color: '#D8D8DA', letterSpacing: 1.5, marginBottom: 12 },
  lockSubtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 20 },
  pinDotsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 60, gap: 24 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#64748B', backgroundColor: 'transparent' },
  pinDotFilled: { backgroundColor: '#C48A76', borderColor: '#C48A76' },
  numpadContainer: { width: '100%', maxWidth: 320 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  numpadBtn: { width: 75, height: 75, borderRadius: 37.5, backgroundColor: 'rgba(216, 216, 218, 0.03)', borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', justifyContent: 'center', alignItems: 'center' },
  numpadBtnText: { fontSize: 32, fontWeight: '500', color: '#D8D8DA' },
  lockCancelBtn: { marginTop: 30, padding: 10 },
  lockCancelText: { color: '#94A3B8', fontSize: 16, fontWeight: '700' },
  infoModalOverlay: { flex: 1, backgroundColor: 'rgba(17, 26, 66, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  infoModalContent: { width: '100%', backgroundColor: '#12264C', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  infoModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  infoModalTitle: { fontSize: 20, fontWeight: '800', color: '#D8D8DA', marginBottom: 12, letterSpacing: 0.5 },
  infoModalText: { fontSize: 15, color: '#94A3B8', lineHeight: 22, marginBottom: 24 },
  infoModalBtn: { backgroundColor: 'rgba(196, 138, 118, 0.15)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C48A76' },
  infoModalBtnText: { color: '#C48A76', fontSize: 16, fontWeight: '700' },
  helpCenterContent: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
  helpCenterSubtitle: { fontSize: 16, color: '#94A3B8', marginBottom: 24, textAlign: 'center' },
  helpBigCard: { flexDirection: 'row', backgroundColor: 'rgba(216, 216, 218, 0.05)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)', alignItems: 'center' },
  helpIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  helpTextCol: { flex: 1, paddingRight: 10 },
  helpCardTitle: { fontSize: 18, fontWeight: '700', color: '#D8D8DA', marginBottom: 4 },
  helpCardSub: { fontSize: 13, color: '#94A3B8', lineHeight: 18 },

  chatScroll: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 10 },
  chatBubbleWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 },
  chatBubbleLeft: { justifyContent: 'flex-start' },
  chatBubbleRight: { justifyContent: 'flex-end' },
  botAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#D8D8DA', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  chatBubble: { maxWidth: '75%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20 },
  chatBot: { backgroundColor: 'rgba(216, 216, 218, 0.1)', borderBottomLeftRadius: 4 },
  chatUser: { backgroundColor: 'rgba(196, 138, 118, 0.2)', borderBottomRightRadius: 4, borderWidth: 1, borderColor: 'rgba(196, 138, 118, 0.4)' },
  chatText: { fontSize: 15, lineHeight: 22 },
  chatTextBot: { color: '#D8D8DA' },
  chatTextUser: { color: '#C48A76', fontWeight: '500' },
  chatInputArea: { backgroundColor: 'rgba(17, 26, 66, 0.95)', borderTopWidth: 1, borderTopColor: 'rgba(216, 216, 218, 0.1)', paddingVertical: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  chatHelperText: { fontSize: 12, color: '#64748B', paddingHorizontal: 24, marginBottom: 12, fontWeight: '600' },
  chatOptionsScroll: { paddingHorizontal: 24, gap: 10, paddingBottom: 16 },
  chatOptionChip: { backgroundColor: 'rgba(216, 216, 218, 0.05)', borderWidth: 1, borderColor: '#64748B', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, width: '100%' },
  chatOptionText: { color: '#D8D8DA', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  currenciesBtnSecondary: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.1)' },
  currenciesBtnIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(216, 216, 218, 0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  currenciesBtnTextSecondary: { flex: 1, color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  aboutScrollContainer: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 10 },
  aboutTopHeader: { alignItems: 'center', marginBottom: 40 },
  aboutLogoCentered: { width: 110, height: 110, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(196, 138, 118, 0.4)', marginBottom: 16 },
  aboutSloganMain: { fontSize: 18, fontStyle: 'italic', color: '#D8D8DA', textAlign: 'center', fontWeight: '600', letterSpacing: 0.5 },
  aboutTextWrapper: { paddingHorizontal: 8 },
  aboutText: { fontSize: 16, color: '#94A3B8', lineHeight: 28, letterSpacing: 0.2, textAlign: 'left', fontWeight: '400' },
  aboutTextHighlight: { color: '#C48A76', fontWeight: '600', fontStyle: 'italic', marginTop: 12 },
  aboutIconSeparator: { alignItems: 'center', marginVertical: 24, opacity: 0.8 },
  emptyStateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, backgroundColor: 'rgba(216, 216, 218, 0.02)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(216, 216, 218, 0.05)' },
  emptyStateText: { color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 8 },
  plansScrollContainer: { paddingHorizontal: 24, paddingVertical: 10, alignItems: 'center' },
  planCard: { width: Dimensions.get('window').width * 0.82, height: '94%', borderRadius: 24, padding: 24, marginRight: 16, borderWidth: 2, justifyContent: 'space-between' },
  planHeader: { marginBottom: 20 },
  planTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  planPrice: { fontSize: 40, fontWeight: '800', color: '#D8D8DA', marginBottom: 4 },
  planPeriod: { fontSize: 16, fontWeight: '500', color: '#94A3B8' },
  planDesc: { fontSize: 14, color: '#94A3B8', lineHeight: 20 },
  planFeaturesScroll: { flex: 1, marginBottom: 20 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingRight: 10 },
  planFeatureText: { fontSize: 14, color: '#D8D8DA', marginLeft: 12, lineHeight: 20, flex: 1 },
  planFeatureSubTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginTop: 10, marginBottom: 16 },
  planFeatureBox: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8, marginBottom: 10 },
  planFeatureMiniText: { fontSize: 13, color: '#94A3B8', marginBottom: 8, lineHeight: 18 },
  planBtn: { borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center' },
  planBtnText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  deleteSwipeBtn: { backgroundColor: '#F44336', justifyContent: 'center', alignItems: 'center', width: 75, borderRadius: 20, marginBottom: 0, marginLeft: 12 },
});