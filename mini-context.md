# PeasyPrints - Technical Context

## Quick Overview
PeasyPrints is a Flutter-based print shop management application that connects users with local print shops. Users can upload PDF documents, configure print settings, and make payments through Razorpay. The app uses Firebase for backend services and follows a monolithic architecture with Provider state management.

## Technology Stack
- **Platform:** Flutter 3.6.2
- **Language:** Dart ^3.6.2
- **State Management:** Provider ^6.0.5 (ChangeNotifier pattern)
- **Navigation:** Navigator 1.0 with named routes
- **Database:** Firebase Firestore (real-time NoSQL)
- **Authentication:** Firebase Auth (Phone OTP + Email/Password)
- **Storage:** Firebase Storage (file uploads)
- **HTTP Client:** Firebase SDK (no external HTTP client)
- **Payment:** Razorpay Flutter SDK ^1.3.5
- **PDF Processing:** Syncfusion Flutter PDF ^30.1.42, pdf ^3.11.1
- **File Handling:** file_picker ^10.1.9, path_provider ^2.0.15
- **Location:** geolocator ^14.0.0
- **UI:** Material Design with google_fonts ^6.1.0
- **Permissions:** permission_handler ^12.0.1
- **Phone Input:** intl_phone_field ^3.1.0

## Architecture
**Monolithic Architecture** - All UI screens and business logic are contained in `lib/main.dart` (4535 lines). Uses Provider pattern for global state management through `GlobalVarProvider.dart`. No separation of concerns - screens, widgets, and business logic are mixed in single file.

**State Management Pattern:**
```dart
// GlobalProvider manages pricing and file state
class GlobalProvider extends ChangeNotifier {
  int A4SingBlaWh = 2;
  int A4SingColor = 5;
  // ... other pricing variables
  late File finalFile;
  
  void updateValues({...}) {
    // Update logic
    notifyListeners();
  }
}
```

**Navigation Structure:**
- SplashScreen → LoginScreen/HomePage
- HomePage (BottomNavigationBar) → HomeScreen, ShopsScreen, OrdersScreen, ProfileScreen
- ShopsScreen → UploadScreen → CustomDialog (payment)

## External Services
- **Firebase Auth:** Phone OTP verification, email/password authentication
- **Firebase Firestore:** Real-time shop data, user profiles, order management
- **Firebase Storage:** PDF file uploads for orders
- **Razorpay API:** Payment processing with checkout integration
- **Google Services:** Location services for shop discovery
- **SMS Gateway:** Firebase Auth phone verification

**Firebase Collections:**
- `users`: User profiles and authentication data
- `shops`: Print shop information and pricing
- `orders`: Order details with print settings and status
- `app_config`: App version and update management

## Core Business Entities
- **User:** Authentication, profile data, order history
- **Shop:** Location, pricing (A4/A3, color/B&W, binding), services
- **Order:** File upload, print settings, payment, status tracking
- **Print Settings:** Paper size, color, format, binding, orientation, copies

**Key Business Logic:**
- Dynamic pricing based on paper size, color, format, binding
- PDF processing (page counting, rotation, file manipulation)
- Location-based shop discovery
- Real-time order status updates
- Emergency print service with premium pricing

## Development Patterns
**Widget Creation:** StatelessWidget for simple displays, StatefulWidget for forms and complex interactions

**State Management:**
```dart
// Provider usage pattern
final globalProvider = context.watch<GlobalProvider>();
int price = globalProvider.A4SingBlaWh;
```

**API Call Patterns:**
- Firebase Firestore: `FirebaseFirestore.instance.collection('shops').snapshots()`
- Firebase Storage: `FirebaseStorage.instance.ref().putFile(file)`
- Razorpay: `Razorpay().open(options)`

**Error Handling:** Try-catch blocks with SnackBar notifications for user feedback

**Navigation Patterns:**
```dart
Navigator.pushReplacementNamed(context, '/home');
Navigator.push(context, MaterialPageRoute(builder: (context) => Screen()));
```

**Data Validation:** Form validation with TextFormField, regex patterns for phone numbers

## Key Implementation Notes
- **Monolithic Structure:** All code in `main.dart` - no file separation
- **Firebase Integration:** Heavy reliance on Firebase services for backend
- **PDF Processing:** Local PDF manipulation before cloud upload
- **Payment Flow:** Razorpay checkout → Firebase Storage upload → Firestore order creation
- **Location Services:** Permission handling with fallback dialogs
- **Real-time Updates:** StreamBuilder for live data from Firestore
- **File Handling:** Local PDF processing with Syncfusion library

**Critical Dependencies:**
- Firebase services require proper configuration
- Razorpay requires merchant account setup
- Location permissions must be handled gracefully
- PDF processing libraries for file manipulation

## Migration Considerations
- **Monolithic to Modular:** Current single-file structure needs refactoring
- **State Management:** Consider migration to Riverpod or Bloc for complex state
- **Navigation:** Navigator 2.0 or GoRouter for better routing
- **Architecture:** Implement Clean Architecture or MVVM pattern
- **Testing:** Current structure makes unit testing difficult
- **Code Organization:** Separate screens, services, models into proper directories
- **Dependency Injection:** Implement proper DI for better testability
- **Error Handling:** Centralized error handling strategy needed
- **Offline Support:** Current implementation requires internet connectivity

**Technology Dependencies:**
- Firebase project configuration required
- Razorpay merchant account and API keys
- Google Services for location features
- PDF processing libraries for file operations
- Permission handling for device features
