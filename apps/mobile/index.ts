// Entry of the app: Expo Router, plus the task handler of the Android home screen widget (react-native-android-widget
// runs it headless when the widget is added, updated or tapped).
import 'expo-router/entry';
import { LogBox } from 'react-native';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';

import { SingleDeviceConfigScreen } from './src/widget/SingleDeviceConfigScreen';
import { widgetTaskHandler } from './src/widget/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);
registerWidgetConfigurationScreen(SingleDeviceConfigScreen);

// Dev-only noise from react-native-reorderable-list (edit mode): its documented ScrollViewContainer + NestedReorderableList
// pair makes React Native warn about a list inside a ScrollView; the lists are short and never scroll on their own.
LogBox.ignoreLogs(['VirtualizedLists should never be nested', '[Reanimated] Dependencies should only be used on the web']);
