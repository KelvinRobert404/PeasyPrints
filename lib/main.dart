import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'dart:async';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:file_picker/file_picker.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:open_file/open_file.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';
import 'package:provider/provider.dart';
import 'GlobalVarProvider.dart';
import 'package:path_provider/path_provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'firebase_options.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:intl_phone_field/intl_phone_field.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:google_fonts/google_fonts.dart';


Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => GlobalProvider()),
      ],
      child: PrintEaseApp(),
    ),
  );
}

class PrintEaseApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        radioTheme: RadioThemeData(
          fillColor: MaterialStateProperty.all(Colors.blue),
        ),
      ),
      home: SplashScreen(),
      routes: {
        '/login': (context) => LoginScreen(),
        '/home': (context) => HomePage(),
      },
    );
  }
}

class SplashScreen extends StatefulWidget {
  @override
  _SplashScreenState createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigate();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(seconds: 2));
    final user = FirebaseAuth.instance.currentUser;

    if (!mounted) return;

    if (user != null) {
      Navigator.pushReplacementNamed(context, '/home');
    } else {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.blue,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Image(
              image: AssetImage('assets/images/PeasyLogo.png'),
              width: 310,
              height: 310,
              color: Colors.white,
              colorBlendMode: BlendMode.srcIn,
            ),
          ],
        ),
      ),
    );
  }
}

class HomePage extends StatefulWidget {
  @override
  _HomePageState createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _selectedIndex = 0;

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  final List<Widget> _pages = [
    HomeScreen(),
    ShopsScreen(),
    OrdersScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
        selectedItemColor: Colors.blueAccent,
        unselectedItemColor: Colors.grey,
        items: [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: "Home"),
          BottomNavigationBarItem(icon: Icon(Icons.store), label: "Shops"),
          BottomNavigationBarItem(
              icon: Icon(Icons.shopping_cart), label: "Orders"),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: "Profile"),
        ],
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  String? currentLocation;

  @override
  void initState() {
    super.initState();
    fetchLocation();
    checkForUpdates();
  }

  Future<void> checkForUpdates() async {
    try {
      PackageInfo packageInfo = await PackageInfo.fromPlatform();
      String currentVersion = packageInfo.version;

      DocumentSnapshot versionDoc =
      await _firestore.collection('app_config').doc('version').get();

      if (versionDoc.exists) {
        String latestVersion = versionDoc.get('latest_version');
        bool isMandatory = versionDoc.get('is_mandatory') ?? false;

        if (compareVersions(latestVersion, currentVersion) > 0) {
          showUpdateDialog(latestVersion, isMandatory);
        }
      }
    } catch (e) {
      print('Error checking for updates: $e');
    }
  }

  int compareVersions(String latest, String current) {
    List<int> latestParts = latest.split('.').map(int.parse).toList();
    List<int> currentParts = current.split('.').map(int.parse).toList();

    for (int i = 0; i < latestParts.length; i++) {
      int latestPart = latestParts[i];
      int currentPart = i < currentParts.length ? currentParts[i] : 0;

      if (latestPart > currentPart) return 1;
      if (latestPart < currentPart) return -1;
    }
    return 0;
  }

  void showUpdateDialog(String latestVersion, bool isMandatory) {
    showDialog(
      context: context,
      barrierDismissible: !isMandatory,
      builder: (BuildContext context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16.0),
          ),
          elevation: 8.0,
          child: Container(
            padding: EdgeInsets.all(20.0),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16.0),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10.0,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header with app icon or logo
                Container(
                  padding: EdgeInsets.all(12.0),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.system_update,
                    size: 40.0,
                    color: Colors.blueAccent,
                  ),
                ),
                SizedBox(height: 16.0),
                // Title
                Text(
                  'New Update Available!',
                  style: GoogleFonts.poppins(
                    fontSize: 22.0,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                SizedBox(height: 12.0),
                // Content
                Text(
                  'Version $latestVersion is ready! ${isMandatory ? 'This update is required to continue using Peasy Prints.' : 'Update now for new features and improved performance.'}',
                  style: GoogleFonts.poppins(
                    fontSize: 16.0,
                    color: Colors.grey[700],
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: 20.0),
                // Action Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (!isMandatory)
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: Text(
                          'Later',
                          style: GoogleFonts.poppins(
                            fontSize: 16.0,
                            color: Colors.grey[600],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    SizedBox(width: 16.0),
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Colors.blueAccent, Colors.blue],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(8.0),
                      ),
                      child: ElevatedButton(
                        onPressed: () {
                          launchPlayStore();
                          if (isMandatory) {
                            Navigator.pop(context);
                          } else {
                            Navigator.pop(context);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          padding: EdgeInsets.symmetric(
                            horizontal: 24.0,
                            vertical: 12.0,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8.0),
                          ),
                        ),
                        child: Text(
                          'Update Now',
                          style: GoogleFonts.poppins(
                            fontSize: 16.0,
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void launchPlayStore() async {
    const String packageName = 'com.peasyprints.consumer';
    final String playStoreUrl = 'market://details?id=$packageName';
    final String webUrl =
        'https://play.google.com/store/apps/details?id=$packageName';

    try {
      if (await canLaunch(playStoreUrl)) {
        await launch(playStoreUrl);
      } else {
        await launch(webUrl);
      }
    } catch (e) {
      print('Error launching Play Store: $e');
    }
  }

  Future<void> fetchLocation() async {
    String? location = await checkAndFetchLocation();
    if (location != null) {
      setState(() {
        currentLocation = location;
      });
    }
  }

  Future<String?> checkAndFetchLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      bool proceed = await showInitialLocationDialog();
      if (!proceed) return null;

      bool enabled = await requestLocationService();
      if (!enabled) {
        bool retry = await showLocationRequiredDialog();
        if (retry) {
          return await checkAndFetchLocation();
        }
        return null;
      }
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        bool proceed = await showInitialLocationDialog();
        if (!proceed) return null;

        bool enabled = await requestLocationService();
        if (!enabled) {
          bool retry = await showLocationRequiredDialog();
          if (retry) {
            return await checkAndFetchLocation();
          }
          return null;
        }

        permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) return null;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      bool proceed = await showInitialLocationDialog();
      if (!proceed) return null;

      bool enabled = await requestLocationService();
      if (!enabled) {
        bool retry = await showLocationRequiredDialog();
        if (retry) {
          return await checkAndFetchLocation();
        }
        return null;
      }

      permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.deniedForever) return null;
    }

    try {
      Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high);
      return "${position.latitude}, ${position.longitude}";
    } catch (e) {
      print('Error fetching location: $e');
      return null;
    }
  }

  Future<bool> showInitialLocationDialog() async {
    return await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return WillPopScope(
          onWillPop: () async => false,
          child: AlertDialog(
            title: Text("Enable Location"),
            content: Text(
              "Location services are required to find nearby shops. Do you want to enable location services?",
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context, false);
                },
                child: Text("No"),
              ),
              TextButton(
                onPressed: () {
                  Navigator.pop(context, true);
                },
                child: Text("Yes"),
              ),
            ],
          ),
        );
      },
    ) ??
        false;
  }

  Future<bool> requestLocationService() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      await Geolocator.openLocationSettings();
      await Future.delayed(Duration(seconds: 2));
      return await Geolocator.isLocationServiceEnabled();
    }
    return true;
  }

  Future<bool> showLocationRequiredDialog() async {
    return await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return WillPopScope(
          onWillPop: () async => false,
          child: AlertDialog(
            title: Text("Location Required"),
            content: Text(
              "Location is necessary to show nearby shops. Please enable location services to continue.",
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context, true);
                },
                child: Text("Try Again"),
              ),
              TextButton(
                onPressed: () {
                  Navigator.pop(context, false);
                },
                child: Text("Cancel"),
              ),
            ],
          ),
        );
      },
    ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.blue.shade50,
      body: Padding(
        padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  "Welcome to Peasy Prints",
                  style: GoogleFonts.poppins(
                      fontSize: 22, fontWeight: FontWeight.bold),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  "Your one-stop printing solution",
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    color: Colors.grey,
                  ),
                ),
              ),
              SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          final mainPageState =
                          context.findAncestorStateOfType<_HomePageState>();
                          if (mainPageState != null) {
                            mainPageState._onItemTapped(1);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          minimumSize: Size(double.infinity, 50),
                          backgroundColor: Colors.blue,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8.0),
                          ),
                        ),
                        child: Text(
                          "Print Now",
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          final mainPageState =
                          context.findAncestorStateOfType<_HomePageState>();
                          if (mainPageState != null) {
                            mainPageState._onItemTapped(2);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          minimumSize: Size(double.infinity, 50),
                          backgroundColor: Colors.blue,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8.0),
                          ),
                        ),
                        child: Text(
                          "Orders",
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  "Shops Nearby",
                  style: GoogleFonts.poppins(
                      fontSize: 17, fontWeight: FontWeight.w600),
                ),
              ),
              SizedBox(height: 10),
              SizedBox(
                height: 329,
                child:
                StreamBuilder<QuerySnapshot>(
                  stream: _firestore.collection('shops').snapshots(),
                  builder: (context, snapshot) {
                    if (snapshot.hasError)
                      return Center(child: Text('Error: ${snapshot.error}'));
                    if (!snapshot.hasData)
                      return Center(child: CircularProgressIndicator());

                    return ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: snapshot.data!.docs.length,
                      separatorBuilder: (context, index) => SizedBox(),
                      itemBuilder: (context, index) {
                        final doc = snapshot.data!.docs[index];
                        final data = doc.data() as Map<String, dynamic>;
                        final pricing = data['pricing'] ?? {};

                        final a4Pricing = pricing['A4 Paper Pricing'] ?? {};
                        final a3Pricing = pricing['A3 Paper Pricing'] ?? {};
                        final services = pricing['Additional Services'] ?? {};

                        return Padding(
                          padding: const EdgeInsets.only(left: 10.0, bottom: 10),
                          child: SizedBox(
                            width: 200,
                            child: ShopCard(
                              doc.id,
                              data['name'] ?? 'Shop Name',
                              data['address'] ?? 'Address not available',
                              data['timing'] ?? '10AM to 6PM',
                              data['logoUrl'] ?? 'assets/default_shop.jpg',
                              (a4Pricing['Single-sided Black & White'] ?? 0.0).toDouble(),
                              (a4Pricing['Double-sided Black & White'] ?? 0.0).toDouble(),
                              (a4Pricing['Single-sided Color'] ?? 0.0).toDouble(),
                              (a4Pricing['Double-sided Color'] ?? 0.0).toDouble(),
                              (a3Pricing['Single-sided Black & White'] ?? 0.0).toDouble(),
                              (a3Pricing['Double-sided Black & White'] ?? 0.0).toDouble(),
                              (a3Pricing['Single-sided Color'] ?? 0.0).toDouble(),
                              (a3Pricing['Double-sided Color'] ?? 0.0).toDouble(),
                              (services['Soft Binding'] ?? 0.0).toDouble(),
                              (services['Hard Binding'] ?? 0.0).toDouble(),
                              (services['Emergency Printing'] ?? 0.0).toDouble(),
                            ),
                          ),
                        );
                      },
                    );
                  },
                )              ),
              RecentOrdersWidget(),
            ],
          ),
        ),
      ),
    );
  }
}

class OrdersScreen extends StatelessWidget {
  final bool fromUploadScreen;

  const OrdersScreen({Key? key, this.fromUploadScreen = false})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text("Orders")),
        body: const Center(child: Text("Please login to view orders")),
      );
    }

    return WillPopScope(
      onWillPop: () async {
        print(
            "Back button pressed on OrdersScreen, fromUploadScreen: $fromUploadScreen");
        if (fromUploadScreen) {
          // Clear stack to HomeScreen
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (context) => HomePage()),
            // Adjust to your HomeScreen
                (Route<dynamic> route) => false,
          );
          return false; // Prevent default pop
        }
        return true; // Allow default pop
      },
      child: Scaffold(
        backgroundColor: Colors.blue.shade50,
        appBar: AppBar(
            title: Text("My Orders",
                style: GoogleFonts.poppins(fontWeight: FontWeight.w700))),
        body: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 10),
              Expanded(
                child: StreamBuilder<QuerySnapshot>(
                  stream: FirebaseFirestore.instance
                      .collection('orders')
                      .where('userId', isEqualTo: user.uid)
                      .orderBy('timestamp', descending: true)
                      .snapshots(),
                  builder: (context, snapshot) {
                    if (snapshot.hasError) {
                      return Center(child: Text('Error: ${snapshot.error}'));
                    }

                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(
                        child: CircularProgressIndicator(
                          valueColor:
                          AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      );
                    }

                    final orders = snapshot.data!.docs;

                    return ListView.builder(
                      itemCount: orders.length,
                      itemBuilder: (context, index) {
                        final order =
                        orders[index].data() as Map<String, dynamic>;
                        return OrderCard(
                          filename: order["fileName"],
                          orderId: orders[index].id,
                          shopId: order['shopId'],
                          shopName: order['shopName'],
                          date: _formatTimestamp(order['timestamp']),
                          pages: "${order['totalPages']} pages",
                          price:
                          "₹${order['totalCost']?.toStringAsFixed(2) ?? '0.00'}",
                          status: order['status'] ?? 'pending',
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTimestamp(Timestamp timestamp) {
    final date = timestamp.toDate();
    return DateFormat('yyyy-MM-dd').format(date);
  }
}

class OrderCard extends StatelessWidget {
  final String filename;
  final String orderId;
  final String shopId;
  final String shopName;
  final String date;
  final String pages;
  final String price;
  final String status;

  OrderCard({
    required this.filename,
    required this.orderId,
    required this.shopId,
    required this.shopName,
    required this.date,
    required this.pages,
    required this.price,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    Color statusColor = Colors.blue;
    if (status == 'completed') statusColor = Colors.green;
    if (status == 'pending') statusColor = Colors.orange;
    if (status == 'cancelled') statusColor = Colors.red;

    return GestureDetector(
      onTap: () => _showOrderDetails(context, orderId),
      child: Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: Padding(
          padding: EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    truncateWithEllipsis(15, filename),
                    style: TextStyle(fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      status.toUpperCase(),
                      style: TextStyle(
                          color: statusColor, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 5),
              Text(shopName, style: TextStyle(fontSize: 16)),
              SizedBox(height: 5),
              Text(date, style: TextStyle(color: Colors.grey)),
              Text(pages, style: TextStyle(color: Colors.grey)),
              Text(price, style: TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }

  void _showOrderDetails(BuildContext context, String orderId) {
    showDialog(
      context: context,
      builder: (context) => OrderDetailsDialog(orderId: orderId),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final currentUser = FirebaseAuth.instance.currentUser;

    return Scaffold(
      backgroundColor: Colors.blue.shade50,
      appBar: AppBar(
        title: Text("Profile", style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 20),
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: Colors.grey[300],
                    child: const Icon(Icons.person, size: 40, color: Colors.black54),
                  ),
                  const SizedBox(height: 10),
                  FutureBuilder<DocumentSnapshot>(
                    future: FirebaseFirestore.instance
                        .collection('users')
                        .doc(currentUser?.uid)
                        .get(),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const CircularProgressIndicator();
                      }
                      if (snapshot.hasError || !snapshot.hasData || !snapshot.data!.exists) {
                        return const Text("Username not found", style: TextStyle(fontSize: 16, color: Colors.black54));
                      }

                      final username = snapshot.data!.get('username') ?? "User";
                      return Text(username, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold));
                    },
                  ),
                  const SizedBox(height: 5),
                  Text(currentUser?.email ?? "No email", style: const TextStyle(fontSize: 16, color: Colors.black54)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Divider(),
            _buildSectionHeader("Account"),
            _buildListTile("Edit Profile", Icons.edit, context),
            _buildListTile("Payment Methods", Icons.payment, context),
            _buildListTile("Notifications", Icons.notifications, context),
            const SizedBox(height: 10),
            const Divider(),
            _buildSectionHeader("Support"),
            _buildListTile("Help Center", Icons.help, context),
            _buildListTile("Contact Us", Icons.contact_support, context, onTap: () {
              _showPolicyDialog(context, "Contact Us", _contactUsText);
            }),
            _buildListTile("Cancellation & Refunds", Icons.cancel, context, onTap: () {
              _showPolicyDialog(context, "Cancellation & Refunds", _cancellationPolicyText);
            }),
            _buildListTile("Shipping Policy", Icons.local_shipping, context, onTap: () {
              _showPolicyDialog(context, "Shipping & Delivery Policy", _shippingPolicyText);
            }),
            _buildListTile("Terms & Conditions", Icons.policy, context, onTap: () {
              _showPolicyDialog(context, "Terms & Conditions", _termsAndConditionsText);
            }),
            _buildListTile("Privacy Policy", Icons.privacy_tip, context, onTap: () async {
              final Uri url = Uri.parse('https://www.privacypolicies.com/live/aec90ef1-2e50-4fd7-b2d6-6ed45ee41b2c');
              if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not launch the URL')));
              }
            }),
            const SizedBox(height: 20),
            Center(
              child: ElevatedButton(
                onPressed: () async {
                  try {
                    await FirebaseAuth.instance.signOut();
                    Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Logout failed: ${e.toString()}')));
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 15),
                ),
                child: const Text("Log Out", style: TextStyle(color: Colors.white)),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(title,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: Colors.grey[700],
        ),
      ),
    );
  }

  Widget _buildListTile(String title, IconData icon, BuildContext context, {VoidCallback? onTap}) {
    return ListTile(
      leading: Icon(icon, color: Colors.blue),
      title: Text(title),
      trailing: const Icon(Icons.arrow_forward_ios, size: 16),
      onTap: onTap ?? () {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$title feature coming soon!')));
      },
    );
  }

  void _showPolicyDialog(BuildContext context, String title, String content) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.8,
        minChildSize: 0.6,
        maxChildSize: 0.95,
        builder: (_, controller) => Padding(
          padding: const EdgeInsets.all(16),
          child: ListView(
            controller: controller,
            children: [
              Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              Text(content, style: const TextStyle(fontSize: 15, height: 1.5)),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}

// --- Policy Texts ---
const String _cancellationPolicyText = '''
Last updated on Jul 10 2025

KELVIN ROBERT believes in helping its customers as far as possible, and has therefore a liberal cancellation policy. Under this policy:

- Cancellations will be considered only if the request is made within 7 days of placing the order. However, the cancellation request may not be entertained if the orders have been communicated to the vendors/merchants and they have initiated the process of shipping them.

- KELVIN ROBERT does not accept cancellation requests for perishable items like flowers, eatables etc. However, refund/replacement can be made if the customer establishes that the quality of product delivered is not good.

- In case of receipt of damaged or defective items please report the same to our Customer Service team within 7 days. The request will be entertained once the merchant verifies it.

- If you feel that the product received is not as shown or as per your expectations, notify us within 7 days of receiving it. Our team will take appropriate action.

- For products with manufacturer warranties, please contact them directly.

- If any refunds are approved by KELVIN ROBERT, it will take 1–2 days to process to the end customer.
''';

const String _termsAndConditionsText = '''
Last updated on Jul 10 2025

The term "we", "us", "our" used here shall mean KELVIN ROBERT. "You", "user", "visitor" shall mean any person visiting our website or purchasing from us.

Terms:

- Content is subject to change without notice.
- We offer no warranty as to the accuracy or completeness of the content.
- Your use of any materials is at your own risk.
- This website contains copyrighted materials. Unauthorized use may lead to legal actions.
- Trademarks not owned by us are acknowledged.
- Any dispute is subject to Indian law.
- We are not liable for failed transactions due to cardholder limits or authorization issues.
''';

const String _shippingPolicyText = '''
Last updated on Jul 10 2025

- For international buyers: Orders are delivered via registered international courier or speed post.
- For domestic buyers: Shipped via registered courier/post only.
- Orders are dispatched within 0–7 days or as per order confirmation.
- KELVIN ROBERT is not liable for courier delays but guarantees to dispatch within the time frame.
- Delivery will be made to the address provided during checkout.
- Confirmation will be sent to your registered email.

For assistance, contact:
Helpdesk – 9591724976 or Kelvinrobert091@gmail.com
''';

const String _contactUsText = '''
Last updated on Jul 10 2025

Merchant Legal Entity: KELVIN ROBERT

Registered & Operational Address:
B-306, NEELKANTH PARK-1, OPP GOPAL NAGAR,
ST. XAVIERS SCHOOL ROAD, Ahmedabad, Gujarat 380052

Phone: 9591724976
Email: Kelvinrobert091@gmail.com
''';

class ShopsScreen extends StatelessWidget {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.blue.shade50,
      appBar: AppBar(
          title: Text("Select Shop",
              style: GoogleFonts.poppins(fontWeight: FontWeight.w700))),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              decoration: InputDecoration(
                hintText: "Search by shop name or location...",
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            SizedBox(height: 20),
            Expanded(
              child:
              StreamBuilder<QuerySnapshot>(
                stream: _firestore.collection('shops').snapshots(),
                builder: (context, snapshot) {
                  if (snapshot.hasError)
                    return Center(child: Text('Error: ${snapshot.error}'));
                  if (!snapshot.hasData)
                    return Center(child: CircularProgressIndicator());

                  final shops = snapshot.data!.docs;

                  return ListView.builder(
                    itemCount: shops.length,
                    itemBuilder: (context, index) {
                      final doc = shops[index];
                      final data = doc.data() as Map<String, dynamic>;
                      final pricing = data['pricing'] ?? {};

                      final a4Pricing = pricing['A4 Paper Pricing'] ?? {};
                      final a3Pricing = pricing['A3 Paper Pricing'] ?? {};
                      final services = pricing['Additional Services'] ?? {};

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10.0),
                        child: ShopCard(
                          doc.id,
                          data['name'] ?? 'Shop Name',
                          data['address'] ?? 'Address not available',
                          data['timing'] ?? '10AM to 6PM',
                          data['logoUrl'] ?? 'assets/default_shop.jpg',
                          (a4Pricing['Single-sided Black & White'] ?? 0.0).toDouble(),
                          (a4Pricing['Double-sided Black & White'] ?? 0.0).toDouble(),
                          (a4Pricing['Single-sided Color'] ?? 0.0).toDouble(),
                          (a4Pricing['Double-sided Color'] ?? 0.0).toDouble(),
                          (a3Pricing['Single-sided Black & White'] ?? 0.0).toDouble(),
                          (a3Pricing['Double-sided Black & White'] ?? 0.0).toDouble(),
                          (a3Pricing['Single-sided Color'] ?? 0.0).toDouble(),
                          (a3Pricing['Double-sided Color'] ?? 0.0).toDouble(),
                          (services['Soft Binding'] ?? 0.0).toDouble(),
                          (services['Hard Binding'] ?? 0.0).toDouble(),
                          (services['Emergency Printing'] ?? 0.0).toDouble(),
                        ),
                      );
                    },
                  );
                },
              )
            ),
          ],
        ),
      ),
    );
  }
}

class RegistrationScreen extends StatefulWidget {
  const RegistrationScreen({super.key});

  @override
  _RegistrationScreenState createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends State<RegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _phoneNumber;
  bool _isLoading = false;
  bool _useEmailAuth = false;
  int _otpSendFailures = 0;

  Future<void> _sendOTP() async {
    if (!_formKey.currentState!.validate()) return;
    if (_phoneNumber == null || _phoneNumber!.isEmpty) {
      _showError('Please enter a valid phone number');
      return;
    }
    if (!RegExp(r'^\+91[6-9][0-9]{9}$').hasMatch(_phoneNumber!)) {
      _showError('Please enter a valid 10-digit Indian phone number');
      return;
    }

    setState(() => _isLoading = true);
    print('Sending OTP to: $_phoneNumber');

    await Future.delayed(const Duration(milliseconds: 100));

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: _phoneNumber!.trim(),
        timeout: const Duration(seconds: 60),
        verificationCompleted: (PhoneAuthCredential credential) async {
          print('Verification completed automatically');
          setState(() => _isLoading = false);
          try {
            UserCredential userCredential =
            await FirebaseAuth.instance.signInWithCredential(credential);
            await _processAfterSignIn(
                context, userCredential, _usernameController.text.trim());
          } catch (e) {
            print('Auto sign-in error: $e');
            _showError('Auto sign-in failed: ${e.toString()}');
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          print('Verification failed: ${e.code} - ${e.message}');
          setState(() {
            _isLoading = false;
            _otpSendFailures++;
            if (_otpSendFailures >= 3) {
              _useEmailAuth = true;
              _showError(
                  'OTP delivery failed multiple times. Please use email login.');
            } else {
              _showError(
                  'Verification failed: ${e.message ?? 'Unknown error'}');
            }
          });
        },
        codeSent: (String verificationId, int? resendToken) {
          print('Code sent, verificationId: $verificationId');
          setState(() => _isLoading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('OTP sent to $_phoneNumber'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => OTPEntryScreen(
                verificationId: verificationId,
                username: _usernameController.text.trim(),
                phoneNumber: _phoneNumber!,
              ),
            ),
          );
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          print('Timeout, verificationId: $verificationId');
          setState(() {
            _isLoading = false;
            _otpSendFailures++;
            if (_otpSendFailures >= 3) {
              _useEmailAuth = true;
              _showError(
                  'OTP delivery timed out multiple times. Please use email login.');
            } else {
              _showError('Code auto-retrieval timed out');
            }
          });
        },
      );
    } catch (e) {
      print('Error in _sendOTP: $e');
      setState(() {
        _isLoading = false;
        _otpSendFailures++;
        if (_otpSendFailures >= 3) {
          _useEmailAuth = true;
          _showError(
              'An error occurred multiple times. Please use email login.');
        } else {
          _showError('An error occurred: ${e.toString()}');
        }
      });
    }
  }

  Future<void> _registerWithEmail() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      UserCredential userCredential =
      await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );
      await _processAfterSignIn(
          context, userCredential, _usernameController.text.trim());
    } catch (e) {
      print('Email registration error: $e');
      _showError('Registration failed: ${e.toString()}');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.redAccent,
        duration: const Duration(seconds: 5),
      ),
    );
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_useEmailAuth ? "Sign up with Email" : "Sign up with Phone",
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.w700,
              color: Colors.white,
            )),
        backgroundColor: Colors.blue.shade700,
      ),
      body: Stack(
        children: [
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    Image.asset('assets/images/logo.png',
                        width: 120, height: 120),
                    const SizedBox(height: 32),
                    if (_useEmailAuth) ...[
                      TextFormField(
                        controller: _usernameController,
                        decoration: InputDecoration(
                          labelText: 'Username',
                          prefixIcon:
                          Icon(Icons.person, color: Colors.blue.shade700),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Username is required';
                          }
                          if (value.length < 3) {
                            return 'Username must be at least 3 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _emailController,
                        decoration: InputDecoration(
                          labelText: 'Email',
                          prefixIcon:
                          Icon(Icons.email, color: Colors.blue.shade700),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        keyboardType: TextInputType.emailAddress,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Email is required';
                          }
                          if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$')
                              .hasMatch(value)) {
                            return 'Enter a valid email';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _passwordController,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon:
                          Icon(Icons.lock, color: Colors.blue.shade700),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        obscureText: true,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Password is required';
                          }
                          if (value.length < 6) {
                            return 'Password must be at least 6 characters';
                          }
                          return null;
                        },
                      ),
                    ] else ...[
                      TextFormField(
                        controller: _usernameController,
                        decoration: InputDecoration(
                          labelText: 'Username',
                          prefixIcon:
                          Icon(Icons.person, color: Colors.blue.shade700),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Username is required';
                          }
                          if (value.length < 3) {
                            return 'Username must be at least 3 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      IntlPhoneField(
                        decoration: InputDecoration(
                          labelText: 'Phone Number',
                          prefixIcon:
                          Icon(Icons.phone, color: Colors.blue.shade700),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        initialCountryCode: 'IN',
                        showCountryFlag: false,
                        showDropdownIcon: false,
                        onChanged: (phone) {
                          setState(() {
                            _phoneNumber = phone.completeNumber;
                          });
                        },
                        invalidNumberMessage: 'Invalid phone number',
                      ),
                    ],
                    const SizedBox(height: 32),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeInOut,
                      child: ElevatedButton(
                        onPressed: _isLoading
                            ? null
                            : (_useEmailAuth ? _registerWithEmail : _sendOTP),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue.shade700,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 40, vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 3,
                        ),
                        child: Text(
                          _useEmailAuth ? 'Sign Up' : 'Send OTP',
                          style: GoogleFonts.poppins( // Apply Poppins font
                            fontWeight: FontWeight.w600, // Set font weight
                            letterSpacing: 0.5, // Set letter spacing
                            fontSize: 16, // Retain the existing font size
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _useEmailAuth = !_useEmailAuth;
                          _otpSendFailures = 0;
                        });
                      },
                      child: Text(
                        _useEmailAuth ? 'Sign up by Phone' : 'Sign up by Email',
                        style: GoogleFonts.poppins( // Changed TextStyle to GoogleFonts.poppins
                          color: Colors.blue.shade700,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5, // Added letterSpacing to match
                        ),
                      ),                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                            builder: (context) => const LoginScreen()),
                      ),
                      child: Text(
                        "Already have an account? Login",
                        style: GoogleFonts.poppins( // Replaced TextStyle with GoogleFonts.poppins
                          color: Colors.blue.shade700, // Kept the existing color
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.blue),
                backgroundColor: Colors.transparent,
              ),
            ),
        ],
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _phoneNumber;
  bool _isLoading = false;
  bool _useEmailAuth = false;
  int _otpSendFailures = 0;
  bool _isHovered = false;

  Future<void> _sendOTP() async {
    if (!_formKey.currentState!.validate()) return;
    if (_phoneNumber == null || _phoneNumber!.isEmpty) {
      _showError('Please enter a valid phone number');
      return;
    }
    if (!RegExp(r'^\+91[6-9][0-9]{9}$').hasMatch(_phoneNumber!)) {
      _showError('Please enter a valid 10-digit Indian phone number');
      return;
    }

    setState(() => _isLoading = true);
    print('Sending OTP to: $_phoneNumber');

    await Future.delayed(const Duration(milliseconds: 100));

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: _phoneNumber!.trim(),
        timeout: const Duration(seconds: 60),
        verificationCompleted: (PhoneAuthCredential credential) async {
          print('Verification completed automatically');
          setState(() => _isLoading = false);
          try {
            UserCredential userCredential =
            await FirebaseAuth.instance.signInWithCredential(credential);
            await _processAfterSignIn(context, userCredential, null);
          } catch (e) {
            print('Auto sign-in error: $e');
            _showError('Auto sign-in failed: ${e.toString()}');
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          print('Verification failed: ${e.code} - ${e.message}');
          setState(() {
            _isLoading = false;
            _otpSendFailures++;
            if (_otpSendFailures >= 3) {
              _useEmailAuth = true;
              _showError(
                  'OTP delivery failed multiple times. Please use email login.');
            } else {
              _showError(
                  'Verification failed: ${e.message ?? 'Unknown error'}');
            }
          });
        },
        codeSent: (String verificationId, int? resendToken) {
          print('Code sent, verificationId: $verificationId');
          setState(() => _isLoading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('OTP sent to $_phoneNumber'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => OTPEntryScreen(
                verificationId: verificationId,
                username: null,
                phoneNumber: _phoneNumber!,
              ),
            ),
          );
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          print('Timeout, verificationId: $verificationId');
          setState(() {
            _isLoading = false;
            _otpSendFailures++;
            if (_otpSendFailures >= 3) {
              _useEmailAuth = true;
              _showError(
                  'OTP delivery timed out multiple times. Please use email login.');
            } else {
              _showError('Code auto-retrieval timed out');
            }
          });
        },
      );
    } catch (e) {
      print('Error in _sendOTP: $e');
      setState(() {
        _isLoading = false;
        _otpSendFailures++;
        if (_otpSendFailures >= 3) {
          _useEmailAuth = true;
          _showError(
              'An error occurred multiple times. Please use email login.');
        } else {
          _showError('An error occurred: ${e.toString()}');
        }
      });
    }
  }

  Future<void> _loginWithEmail() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      UserCredential userCredential =
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );
      await _processAfterSignIn(context, userCredential, null);
    } catch (e) {
      print('Email login error: $e');
      _showError('Login failed: ${e.toString()}');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.redAccent,
        duration: const Duration(seconds: 5),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: Text(_useEmailAuth ? "Log in with Email" : "Log in with Phone",
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w700,
                color: Colors.white,
              )),
          backgroundColor: Colors.blue.shade700),
      body: Stack(
        children: [
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    Image.asset('assets/images/logo.png',
                        width: 120, height: 120),
                    const SizedBox(height: 16),
                    Text(
                      "Welcome Back!!",
                      style: GoogleFonts.montserrat(
                          fontWeight: FontWeight.w600,
                          color: Colors.blue.shade800,
                          fontSize: 27),
                    ),
                    const SizedBox(height: 32),
                    if (_useEmailAuth) ...[
                      TextFormField(
                        controller: _emailController,
                        decoration: InputDecoration(
                          labelText: 'Email',
                          prefixIcon:
                          Icon(Icons.email, color: Colors.blue.shade700),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        keyboardType: TextInputType.emailAddress,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Email is required';
                          }
                          if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$')
                              .hasMatch(value)) {
                            return 'Enter a valid email';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _passwordController,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon:
                          Icon(Icons.lock, color: Colors.blue.shade700),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        obscureText: true,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Password is required';
                          }
                          if (value.length < 6) {
                            return 'Password must be at least 6 characters';
                          }
                          return null;
                        },
                      ),
                    ] else ...[
                      IntlPhoneField(
                        decoration: InputDecoration(
                          labelText: 'Phone Number',
                          prefixIcon:
                          Icon(Icons.phone, color: Colors.blue.shade700),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        initialCountryCode: 'IN',
                        showCountryFlag: false,
                        showDropdownIcon: false,
                        onChanged: (phone) {
                          setState(() {
                            _phoneNumber = phone.completeNumber;
                          });
                        },
                        invalidNumberMessage: 'Invalid phone number',
                      ),
                    ],
                    const SizedBox(height: 32),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeInOut,
                      child: ElevatedButton(
                        onPressed: _isLoading
                            ? null
                            : (_useEmailAuth ? _loginWithEmail : _sendOTP),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue.shade700,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 40, vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 3,
                        ),
                        child: Text(
                          _useEmailAuth ? 'Log In' : 'Send OTP',
                          style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w600, letterSpacing: 0.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    MouseRegion(
                      cursor: SystemMouseCursors.click,
                      onEnter: (_) => setState(() => _isHovered = true),
                      onExit: (_) => setState(() => _isHovered = false),
                      child: TextButton(
                        onPressed: () {
                          setState(() {
                            _useEmailAuth = !_useEmailAuth;
                            _otpSendFailures = 0;
                          });
                        },
                        child: Text(
                          _useEmailAuth ? 'Log in by Phone' : 'Log in by Email',
                          style: GoogleFonts.poppins( // Changed TextStyle to GoogleFonts.poppins
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5, // Added letterSpacing from your example
                            color: _isHovered
                                ? Colors.blue.shade900
                                : Colors.blue.shade700,
                            decoration: _isHovered ? TextDecoration.underline : null,
                          ),
                        ),                      ),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                            builder: (context) => const RegistrationScreen()),
                      ),
                      child: Text(
                        "Don't have an account? Sign up!",
                        style: GoogleFonts.poppins( // Replaced TextStyle with GoogleFonts.poppins
                          color: Colors.blue.shade700, // Kept the existing color
                        ),
                      ),                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.blue),
                backgroundColor: Colors.transparent,
              ),
            ),
        ],
      ),
    );
  }
}

class OTPEntryScreen extends StatefulWidget {
  final String verificationId;
  final String? username;
  final String phoneNumber;

  const OTPEntryScreen({
    required this.verificationId,
    this.username,
    required this.phoneNumber,
    super.key,
  });

  @override
  _OTPEntryScreenState createState() => _OTPEntryScreenState();
}

class _OTPEntryScreenState extends State<OTPEntryScreen> {
  final List<TextEditingController> _otpControllers =
  List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  bool _isLoading = false;
  bool _isPasting = false;
  bool _canResend = true;
  int _resendCooldown = 30;
  Timer? _cooldownTimer;
  int _otpSendFailures = 0;

  @override
  void initState() {
    super.initState();
    print('OTPEntryScreen initialized with phone: ${widget.phoneNumber}');
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    for (var controller in _otpControllers) {
      controller.dispose();
    }
    for (var focusNode in _focusNodes) {
      focusNode.dispose();
    }
    super.dispose();
  }

  Future<void> _verifyOTP() async {
    String smsCode =
    _otpControllers.map((controller) => controller.text).join();
    if (smsCode.length != 6) {
      _showError('Please enter a 6-digit OTP');
      return;
    }
    try {
      setState(() => _isLoading = true);
      PhoneAuthCredential credential = PhoneAuthProvider.credential(
        verificationId: widget.verificationId,
        smsCode: smsCode,
      );
      UserCredential userCredential =
      await FirebaseAuth.instance.signInWithCredential(credential);
      await _processAfterSignIn(context, userCredential, widget.username);
    } catch (e) {
      print('Verification error: $e');
      _showError('Verification failed: ${e.toString()}');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _resendOTP() async {
    if (_isLoading || !_canResend) return;
    setState(() {
      _isLoading = true;
      _canResend = false;
      for (var controller in _otpControllers) {
        controller.clear();
      }
    });
    print('Resending OTP to: ${widget.phoneNumber} at ${DateTime.now()}');

    try {
      String normalizedPhone = widget.phoneNumber.startsWith('+')
          ? widget.phoneNumber
          : '+${widget.phoneNumber}';
      print('Normalized phone number: $normalizedPhone');

      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: normalizedPhone.trim(),
        timeout: const Duration(seconds: 60),
        verificationCompleted: (PhoneAuthCredential credential) async {
          print('Verification completed automatically with credential: $credential');
          if (mounted) {
            setState(() => _isLoading = false);
            try {
              UserCredential userCredential =
              await FirebaseAuth.instance.signInWithCredential(credential);
              print('User signed in: ${userCredential.user?.uid}');
              await _processAfterSignIn(context, userCredential, widget.username);
            } catch (e) {
              print('Auto sign-in error: $e');
              _showError('Auto sign-in failed: ${e.toString()}');
            }
            _startCooldownTimer();
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          print('Resend failed: ${e.code} - ${e.message}');
          String errorMessage = switch (e.code) {
            'invalid-phone-number' => 'Invalid phone number format.',
            'too-many-requests' => 'Too many requests. Please wait and try again.',
            'network-request-failed' => 'Network error. Check your connection.',
            _ => 'Resend failed: ${e.message ?? 'Unknown error'}',
          };
          if (mounted) {
            setState(() {
              _isLoading = false;
              _otpSendFailures++;
              if (_otpSendFailures >= 3) {
                errorMessage =
                'OTP delivery failed multiple times. Please use email login on the previous screen.';
              }
              _showError(errorMessage);
              _startCooldownTimer();
            });
          }
        },
        codeSent: (String verificationId, int? resendToken) {
          print('Code resent, verificationId: $verificationId, resendToken: $resendToken');
          if (mounted) {
            setState(() {
              _isLoading = false;
              _otpSendFailures = 0;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('OTP sent to ${widget.phoneNumber}'),
                backgroundColor: Colors.green,
              ),
            );
            Future.delayed(const Duration(milliseconds: 100), () {
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (context) => OTPEntryScreen(
                      verificationId: verificationId,
                      username: widget.username,
                      phoneNumber: normalizedPhone,
                    ),
                  ),
                );
              }
            });
            _startCooldownTimer();
          }
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          print('Code auto-retrieval timeout, verificationId: $verificationId');
          if (mounted) {
            setState(() {
              _isLoading = false;
              _otpSendFailures++;
              String errorMessage = _otpSendFailures >= 3
                  ? 'OTP delivery timed out multiple times. Please use email login on the previous screen.'
                  : 'Code auto-retrieval timed out. Please enter OTP manually.';
              _showError(errorMessage);
              _startCooldownTimer();
            });
          }
        },
      );
    } catch (e) {
      print('Error in _resendOTP: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _otpSendFailures++;
          String errorMessage = _otpSendFailures >= 3
              ? 'An error occurred multiple times. Please use email login on the previous screen.'
              : 'An error occurred: ${e.toString()}';
          _showError(errorMessage);
          _startCooldownTimer();
        });
      }
    }
  }

  void _startCooldownTimer() {
    _cooldownTimer?.cancel();
    _resendCooldown = 30;
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCooldown <= 0) {
        if (mounted) {
          setState(() {
            _canResend = true;
            _resendCooldown = 30;
          });
        }
        timer.cancel();
      } else {
        if (mounted) {
          setState(() => _resendCooldown--);
        }
      }
    });
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor:
          message.contains('OTP sent') ? Colors.green : Colors.redAccent,
          duration: const Duration(seconds: 5),
        ),
      );
    }
  }

  void _onOTPChanged(int index, String value) {
    if (_isPasting) return;

    if (value.length == 6) {
      _isPasting = true;
      for (int i = 0; i < 6; i++) {
        if (i < value.length) {
          _otpControllers[i].text = value[i];
        }
      }
      _isPasting = false;
      FocusScope.of(context).requestFocus(_focusNodes[5]);
      _verifyOTP();
      return;
    }

    if (value.length == 1 && index < 5) {
      _focusNodes[index].unfocus();
      FocusScope.of(context).requestFocus(_focusNodes[index + 1]);
    } else if (value.isEmpty && index > 0) {
      _focusNodes[index].unfocus();
      FocusScope.of(context).requestFocus(_focusNodes[index - 1]);
    }

    String smsCode = _otpControllers.map((c) => c.text).join();
    if (smsCode.length == 6) {
      _verifyOTP();
    }
  }

  @override
  Widget build(BuildContext context) {
    print('Rebuilding OTPEntryScreen at ${DateTime.now()}');
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Verify OTP",
          style: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        ),
      ),
      body: Stack(
        children: [
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    "Enter the 6-digit OTP sent to ${widget.phoneNumber}",
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey.shade700,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: List.generate(6, (index) {
                      return SizedBox(
                        width: 50,
                        child: TextField(
                          controller: _otpControllers[index],
                          focusNode: _focusNodes[index],
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          maxLength: 1,
                          decoration: InputDecoration(
                            counterText: '',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(
                                  color: Colors.blue.shade700, width: 2),
                            ),
                            filled: true,
                            fillColor: Colors.grey.shade100,
                          ),
                          onChanged: (value) => _onOTPChanged(index, value),
                          onTap: () {
                            _otpControllers[index].selection = TextSelection(
                              baseOffset: 0,
                              extentOffset: _otpControllers[index].text.length,
                            );
                          },
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 32),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeInOut,
                    child: ElevatedButton(
                      onPressed: _canResend && !_isLoading ? _resendOTP : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue.shade700,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 40, vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 3,
                      ),
                      child: Text(
                        _canResend
                            ? 'Resend OTP'
                            : 'Resend in $_resendCooldown s',
                        style: const TextStyle(fontSize: 16),
                      ),
                    ),
                  ),
                  if (_otpSendFailures >= 3) ...[
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                            builder: (context) => const LoginScreen()),
                      ),
                      child: Text(
                        'Use Email Login Instead',
                        style: TextStyle(
                          color: Colors.blue.shade700,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.blue),
                backgroundColor: Colors.transparent,
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _processAfterSignIn(
      BuildContext context, UserCredential userCredential, String? username) async {
    // Add your logic here for handling successful sign-in
    // Example: Save user data to Firestore and navigate to HomeScreen
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) =>   HomeScreen()),
    );
  }
}

class ShopCard extends StatelessWidget {
  final String shopId;
  final String name;
  final String address;
  final String shopTiming;
  final double A4BlWtSin;
  final double A4BlWtDub;
  final double A4ClrSin;
  final double A4lClrDub;
  final double A3BlWtSin;
  final double A3BlWtDub;
  final double A3ClrSin;
  final double A3lClrDub;
  final double SoftBinding;
  final double SpiralBinding;
  final double Emergency;
  final String image;

  const ShopCard(
      this.shopId,
      this.name,
      this.address,
      this.shopTiming,
      this.image,
      this.A4BlWtSin,
      this.A4BlWtDub,
      this.A4ClrSin,
      this.A4lClrDub,
      this.A3BlWtSin,
      this.A3BlWtDub,
      this.A3ClrSin,
      this.A3lClrDub,
      this.SoftBinding,
      this.SpiralBinding,
      this.Emergency, {
        super.key,
      });

  Widget _buildPriceItem(String title, double price) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0), // Reduced from 6.0
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: GoogleFonts.openSans(
              fontSize: 14, // Reduced from 16
              fontWeight: FontWeight.w500,
            ),
          ),
          Text(
            "₹$price",
            style: GoogleFonts.montserrat(
              fontSize: 14, // Reduced from 16
              fontWeight: FontWeight.w600,
              color: Colors.green[700],
            ),
          ),
        ],
      ),
    );
  }

  Widget buildShopInfoDialog(
      BuildContext context,
      String name,
      String address,
      String shopTiming,
      double A4BlWtSin,
      double A4ClrSin,
      double A4BlWtDub,
      double A4lClrDub,
      double A3BlWtSin,
      double A3ClrSin,
      double A3BlWtDub,
      double A3lClrDub,
      double SoftBinding,
      double SpiralBinding,
      double Emergency) {
    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(15),
      ),
      title: Row(
        children: [
          Icon(Icons.store, color: Colors.black, size: 22),
          SizedBox(width: 8),
          Text(
            "Shop Info",
            style: GoogleFonts.montserrat(
              fontWeight: FontWeight.w600,
              fontSize: 20,
              color: Colors.black,
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            RichText(
              text: TextSpan(
                style: GoogleFonts.openSans(
                  fontSize: 14,
                  color: Colors.grey[800],
                ),
                children: [
                  TextSpan(
                    text: "Name: ",
                  ),
                  TextSpan(
                    text: name,
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w500,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 4),
            RichText(
              text: TextSpan(
                style: GoogleFonts.openSans(
                  fontSize: 14,
                  color: Colors.grey[800],
                ),
                children: [
                  TextSpan(text: "Address: "),
                  TextSpan(
                    text: address,
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w500,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 4),
            RichText(
              text: TextSpan(
                style: GoogleFonts.openSans(
                  fontSize: 14,
                  color: Colors.grey[800],
                ),
                children: [
                  TextSpan(text: "Shop Timings: "),
                  TextSpan(
                    text: shopTiming,
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w500,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 12, thickness: 1, color: Colors.grey[300]),
            Row(
              children: [
                Icon(Icons.article, color: Colors.blue[800], size: 17),
                SizedBox(width: 8),
                Text(
                  "A4 Printing",
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    color: Colors.blue[800],
                  ),
                ),
              ],
            ),
            SizedBox(height: 4),
            _buildPriceItem("Single sided Black & White", A4BlWtSin),
            _buildPriceItem("Single sided Color", A4ClrSin),
            _buildPriceItem("Double sided Black & White", A4BlWtDub),
            _buildPriceItem("Double sided Color", A4lClrDub),
            Divider(height: 12, thickness: 1, color: Colors.grey[300]),
            Row(
              children: [
                Icon(Icons.article, color: Colors.blue[800], size: 21),
                SizedBox(width: 8),
                Text(
                  "A3 Printing",
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    color: Colors.blue[800],
                  ),
                ),
              ],
            ),
            SizedBox(height: 4),
            _buildPriceItem("Single sided Black & White", A3BlWtSin),
            _buildPriceItem("Single sided Color", A3ClrSin),
            _buildPriceItem("Double sided Black & White", A3BlWtDub),
            _buildPriceItem("Double sided Color", A3lClrDub),
            Divider(height: 12, thickness: 1, color: Colors.grey[300]),
            Row(
              children: [
                Icon(Icons.book, color: Colors.blue[800], size: 18),
                SizedBox(width: 8),
                Text(
                  "Binding",
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    color: Colors.blue[800],
                  ),
                ),
              ],
            ),
            SizedBox(height: 4),
            _buildPriceItem("Soft Binding", SoftBinding),
            _buildPriceItem("Spiral Binding", SpiralBinding),
            Divider(height: 12, thickness: 1, color: Colors.grey[300]),
            Row(
              children: [
                Icon(Icons.timer, color: Colors.blue[800], size: 18),
                SizedBox(width: 8),
                Text(
                  "Urgent Printing",
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    color: Colors.blue[800],
                  ),
                ),
              ],
            ),
            SizedBox(height: 4),
            _buildPriceItem("Urgent Printing", Emergency),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(
            "Close",
            style: GoogleFonts.montserrat(
              fontWeight: FontWeight.w600,
              color: Colors.blue,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          builder: (context) => buildShopInfoDialog(
            context,
            name,
            address,
            shopTiming,
            A4BlWtSin,
            A4ClrSin,
            A4BlWtDub,
            A4lClrDub,
            A3BlWtSin,
            A3ClrSin,
            A3BlWtDub,
            A3lClrDub,
            SoftBinding,
            SpiralBinding,
            Emergency,
          ),
        );
      },
      child: Card(
        elevation: 5,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    height: 135,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      image: DecorationImage(
                        image: image.startsWith('http')
                            ? NetworkImage(image)
                            : AssetImage(image) as ImageProvider,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  SizedBox(height: 14),
                  Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: 180),
                      child: SizedBox(
                        height: 40, // Fixed height for two lines of text
                        child: Text(
                          name,
                          style: GoogleFonts.montserrat(
                            fontWeight: FontWeight.w600,
                            color: Colors.black,
                            fontSize: 14,
                          ),
                          softWrap: true,
                          maxLines: 2,
                          textAlign: TextAlign.center,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.location_on,
                          color: Colors.red,
                          size: 12,
                        ),
                        SizedBox(width: 2),
                        Flexible(
                          child: Text(
                            address,
                            style: GoogleFonts.montserrat(
                              fontWeight: FontWeight.w500,
                              color: Colors.black,
                              fontSize: 10,
                            ),
                            softWrap: true,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "₹${A4BlWtSin.toStringAsFixed(2)}/pp",
                          style: GoogleFonts.montserrat(
                            fontWeight: FontWeight.w500,
                            color: Colors.black,
                            fontSize: 12,
                          ),
                        ),
                        ElevatedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => UploadScreen(
                                  ShopId: shopId,
                                  ShopName: name,
                                  A4SingBlaWh: A4BlWtSin,
                                  A4SingColor: A4ClrSin,
                                  A4DoubBlaWh: A4BlWtDub,
                                  A4DoubColor: A4lClrDub,
                                  A3SingBlaWh: A3BlWtSin,
                                  A3SingColor: A3ClrSin,
                                  A3DoubBlaWh: A3BlWtDub,
                                  A3DoubColor: A3lClrDub,
                                  SoftBinding: SoftBinding,
                                  SpiralBinding: SpiralBinding,
                                  EmergencyPr: Emergency,
                                ),
                              ),
                            );
                          },
                          icon: Icon(Icons.print, color: Colors.white, size: 16),
                          label: Text(
                            "Print",
                            style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blueAccent,
                            minimumSize: Size(80, 32),
                            padding: EdgeInsets.symmetric(horizontal: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8.0),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(
                color: Colors.blue,
                borderRadius: BorderRadius.vertical(
                  bottom: Radius.circular(12),
                ),
              ),
              padding: EdgeInsets.symmetric(horizontal: 9, vertical: 6),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 14,
                    color: Colors.white,
                  ),
                  SizedBox(width: 6),
                  Text(
                    "Click on shop for more details",
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}


class OrderDetailsDialog extends StatelessWidget {
  final String orderId;

  const OrderDetailsDialog({super.key, required this.orderId});

  @override
  Widget build(BuildContext context) {
    final currentUser = FirebaseAuth.instance.currentUser;

    return FutureBuilder<DocumentSnapshot>(
      future: FirebaseFirestore.instance.collection('orders').doc(orderId).get(),
      builder: (context, orderSnapshot) {
        if (orderSnapshot.connectionState == ConnectionState.waiting) {
          return Dialog(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: const Center(child: CircularProgressIndicator()),
            ),
          );
        }

        if (!orderSnapshot.hasData || !orderSnapshot.data!.exists) {
          return AlertDialog(
            title: const Text("Error"),
            content: const Text("Order not found"),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text("Close"),
              ),
            ],
          );
        }

        final order = orderSnapshot.data!.data() as Map<String, dynamic>;
        final printSettings = order['printSettings'] as Map<String, dynamic>? ?? {};
        final pricingDetails = order['pricingDetails'] as Map<String, dynamic>? ?? {};
        final shopName = order['shopName'] ?? 'Unknown Shop';
        final printColor = printSettings['printColor'] ?? '-';
        final printFormat = printSettings['printFormat'] ?? '-';
        final paperSize = printSettings['paperSize'] ?? '-';
        final orientation = printSettings['orientation'] ?? '-';
        final binding = printSettings['binding'] ?? '-';
        final vinylColor = printSettings['vinylColor'] ?? '-';
        final customization = printSettings['customMessage'] ?? '';
        final copies = printSettings['copies'] ?? 1;
        final fileName = order['fileName'] ?? 'Document';
        final pages = order['totalPages'] ?? 1;
        final price = order['totalCost']?.toDouble() ?? 0.0;
        final status = order['status'] ?? 'Pending';
        final isPending = status.toLowerCase() == 'pending';
        final isCompleted = status.toLowerCase() == 'completed';
        final isPrinting = status.toLowerCase() == 'printing';

        final now = DateTime.now();
        final formattedDate = DateFormat('MMM dd, yyyy').format(now);
        final formattedTime = DateFormat('hh:mm a').format(now);

        final statusBgColor = isCompleted
            ? Colors.green
            : isPrinting
            ? Colors.orange
            : Colors.red;
        final statusTextColor = Colors.white;

        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.8,
            ),
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // User Name
                    Center(
                      child: FutureBuilder<DocumentSnapshot>(
                        future: FirebaseFirestore.instance
                            .collection('users')
                            .doc(currentUser?.uid)
                            .get(),
                        builder: (context, userSnapshot) {
                          if (userSnapshot.connectionState == ConnectionState.waiting) {
                            return const CircularProgressIndicator();
                          }
                          if (userSnapshot.hasError) {
                            return Text(
                              "Error loading username",
                              style: GoogleFonts.openSans(
                                fontSize: 14,
                                color: Colors.red,
                                fontWeight: FontWeight.w500,
                              ),
                            );
                          }
                          if (!userSnapshot.hasData || !userSnapshot.data!.exists) {
                            return Text(
                              "Username not found",
                              style: GoogleFonts.openSans(
                                fontSize: 14,
                                color: Colors.black54,
                                fontWeight: FontWeight.w500,
                              ),
                            );
                          }

                          final username = userSnapshot.data!.get('username') ?? "User";
                          return Text(
                            username,
                            style: GoogleFonts.montserrat(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: Colors.blue[800],
                            ),
                          );
                        },
                      ),
                    ),

                    // Shop Name
                    const SizedBox(height: 4),
                    Center(
                      child: Text(
                        shopName,
                        style: GoogleFonts.montserrat(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey[800],
                        ),
                      ),
                    ),

                    // Date & Time
                    const SizedBox(height: 4),
                    Center(
                      child: Text(
                        '$formattedDate at $formattedTime',
                        style: GoogleFonts.openSans(
                          fontSize: 10,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),

                    // Status Badge
                    const SizedBox(height: 8),
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                        decoration: BoxDecoration(
                          color: statusBgColor,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: GoogleFonts.montserrat(
                            color: statusTextColor,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 12),
                    const Divider(thickness: 1, height: 1, color: Colors.grey),
                    const SizedBox(height: 8),

                    // Document Info Section
                    Text(
                      'Document Info',
                      style: GoogleFonts.montserrat(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.blue[800],
                      ),
                    ),
                    const SizedBox(height: 6),
                    _buildDetailRow('File Name', fileName),
                    _buildDetailRow('Pages', '$pages pages'),
                    _buildDetailRow('Price', '₹${price.toStringAsFixed(2)}'),

                    const SizedBox(height: 8),
                    const Divider(thickness: 1, height: 1, color: Colors.grey),
                    const SizedBox(height: 8),

                    // Print Settings Section
                    Text(
                      'Print Settings',
                      style: GoogleFonts.montserrat(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.blue[800],
                      ),
                    ),
                    const SizedBox(height: 6),
                    _buildDetailRow('Print Color', printColor),
                    _buildDetailRow('Print Format', printFormat),
                    _buildDetailRow('Paper Size', paperSize),
                    _buildDetailRow('Orientation', orientation),
                    if (binding.isNotEmpty) _buildDetailRow('Binding', binding),
                    if (vinylColor.isNotEmpty) _buildDetailRow('Vinyl Color', vinylColor),
                    if (customization.isNotEmpty) _buildDetailRow('Customization', customization),
                    _buildDetailRow('Copies', copies.toString()),

                    const SizedBox(height: 12),
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ElevatedButton(
                            onPressed: () => Navigator.pop(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blue,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(6),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 10),
                            ),
                            child: Text(
                              'Close',
                              style: GoogleFonts.montserrat(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (isPending) ...[
                            const SizedBox(height: 10),
                            ElevatedButton(
                              onPressed: () => _showCancelDialog(context, orderId),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 10),
                              ),
                              child: Text(
                                'Cancel Order',
                                style: GoogleFonts.montserrat(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _showCancelDialog(BuildContext context, String orderId) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: const Text('Cancel Order'),
          content: const Text('Are you sure you want to cancel this order? This action will delete the order.'),
          actions: <Widget>[
            TextButton(
              child: const Text('Close'),
              onPressed: () {
                Navigator.of(dialogContext).pop();
              },
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Confirm Cancel',
                style: TextStyle(color: Colors.white),
              ),
              onPressed: () async {
                try {
                  await FirebaseFirestore.instance.collection('orders').doc(orderId).delete();
                  Navigator.of(dialogContext).pop(); // Close the dialog
                  Navigator.of(context).pop(); // Close the OrderDetailsDialog
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Order cancelled and deleted')),
                  );
                } catch (e) {
                  Navigator.of(dialogContext).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error cancelling order: ${e.toString()}')),
                  );
                }
              },
            ),
          ],
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: GoogleFonts.montserrat(
                fontWeight: FontWeight.w500,
                color: Colors.grey[700],
                fontSize: 15,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.openSans(
                fontWeight: FontWeight.w500,
                fontSize: 15,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
class RecentOrderCard extends StatelessWidget {
  final String orderId;
  final String status;

  RecentOrderCard({required this.orderId, required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      child: Card(
        color: Colors.white,
        elevation: 3,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: Padding(
          padding: EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(orderId, style: TextStyle(fontWeight: FontWeight.bold)),
              Text("Status: $status", style: TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }
}

class UploadScreen extends StatefulWidget {
  final String ShopId;
  final String ShopName;
  final double  A4SingBlaWh;
  final double A4SingColor;
  final double A4DoubBlaWh;
  final double A4DoubColor;
  final double A3SingBlaWh;
  final double A3SingColor;
  final double A3DoubBlaWh;
  final double A3DoubColor;
  final double SoftBinding;
  final double SpiralBinding;
  final double EmergencyPr;

  UploadScreen({
    required this.ShopId,
    required this.ShopName,
    required this.A4SingBlaWh,
    required this.A4SingColor,
    required this.A4DoubBlaWh,
    required this.A4DoubColor,
    required this.A3SingBlaWh,
    required this.A3SingColor,
    required this.A3DoubBlaWh,
    required this.A3DoubColor,
    required this.SoftBinding,
    required this.SpiralBinding,
    required this.EmergencyPr,
  });

  @override
  _UploadScreenState createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  String? selectedBinding = "";
  String? selectedCoverColor = "";
  String? printOrientation = "Vertical";
  String? selectedPaperSize = "A4";
  String? selectedPrintColor = "Black & White";
  String? selectedPaperType = "Normal";
  String? selectedPrintFormat = "Single-Sided";
  String customMessage = "";
  File? selectedFile;
  bool isEmergencyPrint = false;
  int numberOfCopies = 1;
  int ExtraColorPageCount = 0;

  @override
  Widget build(BuildContext context) {
    final globalProvider = context.watch<GlobalProvider>();
    int Commision = globalProvider.Commision;

    return Scaffold(
      appBar: AppBar(title: Text("Upload Document")),
      body: Stack(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 80),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildRadioOptions("Print Color", ["Black & White", "Color"],
                      selectedPrintColor, (value) {
                        setState(() => selectedPrintColor = value);
                      }),
                  _buildRadioOptions(
                      "Print Format",
                      ["Single-Sided", "Double-Sided"],
                      selectedPrintFormat, (value) {
                    setState(() => selectedPrintFormat = value);
                  }),
                  _buildRadioOptions(
                      "Paper Size", ["A3", "A4"], selectedPaperSize, (value) {
                    setState(() => selectedPaperSize = value);
                  }),
                  _buildRadioOptions("Orientation", ["Vertical", "Horizontal"],
                      printOrientation, (value) {
                        setState(() => printOrientation = value);
                      }),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildRadioOptions(
                          "Binding",
                          ["Soft Binding", "Spiral Binding"],
                          selectedBinding, (value) {
                        setState(() => selectedBinding = value);
                      }),
                      _buildCustomizationField(),
                      Divider(thickness: 1, color: Colors.grey[300]),
                      _buildCopiesCounter(),
                    ],
                  ),
                  SizedBox(height: 5),
                  Center(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue),
                      onPressed: _pickFile,
                      icon:
                      Icon(Icons.attach_file_rounded, color: Colors.white),
                      label: Text("Choose PDF File",
                          style: TextStyle(color: Colors.white)),
                    ),
                  ),
                  SizedBox(height: 10),
                  if (selectedFile != null)
                    Text("Selected File: ${selectedFile!.path.split('/').last}",
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: Colors.blue)),
                  Container(
                    color: Colors.red.shade400,
                    padding: EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SwitchListTile(
                          title: Text("Emergency Print",
                              style: TextStyle(color: Colors.white)),
                          subtitle: Text(
                              "Will be ready within minutes \nExtra ₹20 charges may apply",
                              style: TextStyle(color: Colors.white70)),
                          value: isEmergencyPrint,
                          onChanged: (value) {
                            setState(() => isEmergencyPrint = value);
                          },
                          activeColor: Colors.black,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Floating Submit Button
          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                minimumSize: Size(double.infinity, 50),
                backgroundColor: Colors.blue,
                elevation: 8,
              ),
              onPressed: selectedFile != null
                  ? () {
                showCustomDialog(
                    shopId: widget.ShopId,
                    shopName: widget.ShopName,
                    context: context,
                    title: "Order Summary",
                    paperSize: "Paper Size: $selectedPaperSize",
                    PrintFormat: "$selectedPrintFormat",
                    PrintColor: "$selectedPrintColor",
                    Binding: "Binding: $selectedBinding",
                    EmergencyPrint:
                    "Emergency: ${isEmergencyPrint ? "Yes" : "No"}",
                    Orientation: "$printOrientation",
                    file: selectedFile!,
                    isEmergency: isEmergencyPrint,
                    A4SingBlaWh: widget.A4SingBlaWh,
                    A4SingColor: widget.A4SingColor,
                    A4DoubBlaWh: widget.A4DoubBlaWh,
                    A4DoubColor: widget.A4DoubColor,
                    A3SingBlaWh: widget.A3SingBlaWh,
                    A3SingColor: widget.A3SingColor,
                    A3DoubBlaWh: widget.A3DoubBlaWh,
                    A3DoubColor: widget.A3DoubColor,
                    SoftBinding: widget.SoftBinding,
                    HardBinding: widget.SpiralBinding,
                    EmergencyPr: widget.EmergencyPr,
                    selectedPaperSize: selectedPaperSize,
                    selectedPrintFormat: selectedPrintFormat,
                    selectedPrintColor: selectedPrintColor,
                    selectedBinding: selectedBinding,
                    NumberOfCopies: numberOfCopies,
                    Commision: Commision,
                    customMessage: "$customMessage",
                    selectedCoverColor: selectedCoverColor,
                    extraColorPageCount: ExtraColorPageCount);
              }
                  : null,
              child: Text("Submit", style: TextStyle(color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRadioOptions(String title, List<String> options,
      String? groupValue, Function(String?) onChanged) {
    final isBindingSection = title == "Binding";
    final isPrintColorSection = title == "Print Color";

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        Wrap(
          spacing: 16,
          runSpacing: 4,
          children: options.map((option) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Radio<String>(
                  value: option,
                  groupValue: groupValue,
                  onChanged: (value) {
                    onChanged(value);
                    if (isBindingSection) {
                      setState(() {
                        selectedBinding = value;
                        // Only set default color when binding is selected
                        selectedCoverColor =
                        value != null ? 'Transparent' : null;
                      });
                    }
                    if (isPrintColorSection) {
                      setState(() {
                        selectedPrintColor = value;
                        // Set default paper type when color is selected
                        if (value == "Color") {
                          selectedPaperType = 'Normal';
                        } else {
                          selectedPaperType = null;
                        }
                      });
                    }
                  },
                  activeColor: Colors.blue,
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                Text(option, style: TextStyle(fontSize: 16)),
              ],
            );
          }).toList(),
        ),

        // Paper type options (only visible when Color is selected)
        if (isPrintColorSection && selectedPrintColor == "Color") ...[
          SizedBox(height: 12),
          Text("Paper Type",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Wrap(
            spacing: 16,
            runSpacing: 4,
            children: ["Normal", "Glossy", "Matte"].map((type) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Radio<String>(
                    value: type,
                    groupValue: selectedPaperType,
                    onChanged: (value) {
                      setState(() => selectedPaperType = value);
                    },
                    activeColor: Colors.blue,
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  Text(type, style: TextStyle(fontSize: 16)),
                ],
              );
            }).toList(),
          ),
        ],

        // Vinyl color options (only visible when a binding is selected)
        if (isBindingSection && selectedBinding != null) ...[
          SizedBox(height: 12),
          Text("Color of Vinyl (Plastic Cover of Binding)",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Wrap(
            spacing: 16,
            runSpacing: 4,
            children: ["Transparent", "Blue", "Black", "Grey"].map((color) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Radio<String>(
                    value: color,
                    groupValue: selectedCoverColor,
                    onChanged: (value) {
                      setState(() => selectedCoverColor = value);
                    },
                    activeColor: Colors.blue,
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  Text(color, style: TextStyle(fontSize: 16)),
                ],
              );
            }).toList(),
          ),
        ],

        // Clear binding button (only visible when a binding is selected)
        if (isBindingSection && selectedBinding != null) ...[
          SizedBox(height: 12),
          ElevatedButton(
            onPressed: () {
              setState(() {
                selectedBinding = null;
                selectedCoverColor = null;
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              minimumSize: Size(100, 35),
              padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            ),
            child: Text("Clear Binding", style: TextStyle(color: Colors.white)),
          ),
        ],
        Divider(thickness: 1, color: Colors.grey[300]),
      ],
    );
  }

  Widget _buildCustomizationField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade300),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Customization Message",
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[800],
                ),
              ),
              SizedBox(height: 12),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: TextField(
                  onChanged: (value) {
                    setState(() {
                      customMessage = value;
                      if (customMessage.isEmpty) {
                        ExtraColorPageCount = 0;
                      }
                    });
                  },
                  maxLines: null,
                  keyboardType: TextInputType.multiline,
                  decoration: InputDecoration(
                    hintText:
                    "Add any customization instructions (e.g. First 2 pages color...)",
                    hintStyle: TextStyle(color: Colors.grey[500]),
                    border: InputBorder.none,
                  ),
                  style: TextStyle(fontSize: 14),
                ),
              ),
              SizedBox(height: 12),
              if (customMessage.trim().isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Column(
                    children: [
                      // Warning Message
                      Container(
                        width: double.infinity,
                        padding: EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red[50],
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(8),
                            topRight: Radius.circular(8),
                          ),
                        ),
                        child: Text(
                          "!!Please add the total number of color pages if your print is black&White \n if not added color print wont be printed",
                          style: TextStyle(
                            color: Colors.red[800],
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      // Number of Color Pages Counter
                      Container(
                        width: double.infinity,
                        padding: EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.blue[50],
                          borderRadius: BorderRadius.only(
                            bottomLeft: Radius.circular(8),
                            bottomRight: Radius.circular(8),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          // Changed to center
                          children: [
                            Text(
                              "Number of Color Pages",
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Colors.grey[800],
                              ),
                            ),
                            SizedBox(height: 12),
                            Container(
                              width: 120,
                              decoration: BoxDecoration(
                                color: Colors.blue,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              padding: EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              child: Row(
                                mainAxisAlignment:
                                MainAxisAlignment.spaceBetween,
                                children: [
                                  GestureDetector(
                                    onTap: () {
                                      setState(() {
                                        if (ExtraColorPageCount > 0)
                                          ExtraColorPageCount--;
                                      });
                                    },
                                    child: Container(
                                      padding: EdgeInsets.all(3),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Colors.white.withOpacity(0.2),
                                      ),
                                      child: Icon(
                                        Icons.remove,
                                        color: Colors.white,
                                        size: 15,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    "$ExtraColorPageCount",
                                    style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: () {
                                      setState(() {
                                        ExtraColorPageCount++;
                                      });
                                    },
                                    child: Container(
                                      padding: EdgeInsets.all(3),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Colors.white.withOpacity(0.2),
                                      ),
                                      child: Icon(
                                        Icons.add,
                                        color: Colors.white,
                                        size: 15,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCopiesCounter() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text("Number of copies",
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        Container(
          decoration: BoxDecoration(
            color: Colors.blue,
            borderRadius: BorderRadius.circular(25),
          ),
          padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            children: [
              GestureDetector(
                onTap: () {
                  setState(() {
                    if (numberOfCopies > 1) numberOfCopies--;
                  });
                },
                child: Container(
                  padding: EdgeInsets.all(4),
                  decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(0.2)),
                  child: Icon(Icons.remove, color: Colors.white, size: 18),
                ),
              ),
              SizedBox(width: 12),
              Text("$numberOfCopies",
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white)),
              SizedBox(width: 12),
              GestureDetector(
                onTap: () {
                  setState(() {
                    numberOfCopies++;
                  });
                },
                child: Container(
                  padding: EdgeInsets.all(4),
                  decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(0.2)),
                  child: Icon(Icons.add, color: Colors.white, size: 18),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _pickFile() async {
    FilePickerResult? result = await FilePicker.platform
        .pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
    if (result != null) {
      setState(() => selectedFile = File(result.files.single.path!));
    }
  }
}

class CustomDialog extends StatefulWidget {
  final String shopId;
  final String shopName;
  final String title;
  final String paperSize;
  final String printFormat;
  final String printColor;
  final String binding;
  final String emergencyPrint;
  final String orientation;
  final File file;
  final bool isEmergency;
  final double a4SingBlaWh;
  final double a4SingColor;
  final double a4DoubBlaWh;
  final double a4DoubColor;
  final double a3SingBlaWh;
  final double a3SingColor;
  final double a3DoubBlaWh;
  final double a3DoubColor;
  final double softBinding;
  final double hardBinding;
  final double emergencyPr;
  final String? selectedPaperSize;
  final String? selectedPrintFormat;
  final String? selectedPrintColor;
  final String? selectedBinding;
  final int numberOfCopies;
  final int commision;
  final String customMessage;
  final String? selectedCoverColor;
  final int extraColorPageCount;

  const CustomDialog({
    Key? key,
    required this.shopId,
    required this.shopName,
    required this.title,
    required this.paperSize,
    required this.printFormat,
    required this.printColor,
    required this.binding,
    required this.emergencyPrint,
    required this.orientation,
    required this.file,
    required this.isEmergency,
    required this.a4SingBlaWh,
    required this.a4SingColor,
    required this.a4DoubBlaWh,
    required this.a4DoubColor,
    required this.a3SingBlaWh,
    required this.a3SingColor,
    required this.a3DoubBlaWh,
    required this.a3DoubColor,
    required this.softBinding,
    required this.hardBinding,
    required this.emergencyPr,
    required this.selectedPaperSize,
    required this.selectedPrintFormat,
    required this.selectedPrintColor,
    required this.selectedBinding,
    required this.numberOfCopies,
    required this.commision,
    required this.customMessage,
    required this.selectedCoverColor,
    required this.extraColorPageCount,
  }) : super(key: key);

  @override
  _CustomDialogState createState() => _CustomDialogState();
}

class _CustomDialogState extends State<CustomDialog> {
  bool _isExpanded = false;
  bool _isConfirmLoading = false;
  late File finalfile;
  late Future<int> _pageCountFuture;
  late Razorpay _razorpay;

  @override
  void initState() {
    super.initState();
    finalfile = widget.file;
    _pageCountFuture = getPdfPageCount(widget.file);
    processPdf(widget.file, widget.orientation).then((processedFile) {
      if (mounted) {
        setState(() {
          finalfile = processedFile;
        });
      }
    }).catchError((error) {
      print("Error processing PDF: $error");
    });

    // Initialize Razorpay
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    print("Payment Success: ${response.paymentId}");
    try {
      final totalPages = await _pageCountFuture;
      double totalCost = _calculateTotalCost(totalPages);
      totalCost-=totalCost*0.02;
      await _placeOrderAfterPaymentSuccess(totalCost, totalPages, finalfile);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Payment successful! Order placed.')),
      );
    } catch (e) {
      print("Error after payment success: $e");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error placing order: $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isConfirmLoading = false;
        });
      }
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    print("Payment Error: ${response.code} - ${response.message}");
    setState(() {
      _isConfirmLoading = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Payment failed: ${response.message}')),
    );
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    print("External Wallet: ${response.walletName}");
    setState(() {
      _isConfirmLoading = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('External Wallet: ${response.walletName}')),
    );
  }

  double _calculateTotalCost(int totalPages) {
    double pricePerPage = _calculatePricePerPage();
    double colorPricePerPage = 0.0;
    if (widget.selectedPrintColor == "Black & White") {
      if (widget.selectedPaperSize == "A4") {
        colorPricePerPage = (widget.selectedPrintFormat == "Single-Sided")
            ? widget.a4SingColor
            : widget.a4DoubColor;
      } else {
        colorPricePerPage = (widget.selectedPrintFormat == "Single-Sided")
            ? widget.a3SingColor
            : widget.a3DoubColor;
      }
    }
    double extraColorPageCost = colorPricePerPage * widget.extraColorPageCount;
    double totalCost = totalPages * pricePerPage * widget.numberOfCopies;
    totalCost += extraColorPageCost;

    if (widget.selectedBinding == "Soft Binding") {
      totalCost += widget.softBinding;
    } else if (widget.selectedBinding == "Spiral Binding") {
      totalCost += widget.hardBinding;
    }

    if (widget.isEmergency) totalCost += widget.emergencyPr;
    totalCost += widget.commision;

    // Apply 2% commission
    totalCost += totalCost * 0.02;


    return totalCost;
  }

  void _openRazorpayCheckout(double totalCost) async {
    final user = FirebaseAuth.instance.currentUser;
    String userEmail = user?.email ?? "user@example.com";
    String userPhone = user?.phoneNumber ?? "+919999999999";

    var options = {
      'key': 'rzp_live_RjiRkUvNKz31Iw', // Replace with your Razorpay Key ID
      'amount': totalCost * 100, // Amount in paise
      'name': 'Peasy Prints',
      'description': 'Print Order at ${widget.shopName}',
      'prefill': {
        'email': userEmail,
        'contact': userPhone,
      },
      'external': {
        'wallets': ['paytm']
      }
    };

    try {
      setState(() {
        _isConfirmLoading = true;
      });
      _razorpay.open(options);
    } catch (e) {
      print("Error opening Razorpay: $e");
      setState(() {
        _isConfirmLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error opening Razorpay: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    print("Building CustomDialog, _isConfirmLoading: $_isConfirmLoading");

    return Stack(
      children: [
        FutureBuilder<int>(
          future: _pageCountFuture,
          builder: (context, snapshot) {
            print(
                "FutureBuilder state: ${snapshot.connectionState}, data: ${snapshot.data}, error: ${snapshot.hasError ? snapshot.error : 'none'}");

            double pricePerPage = _calculatePricePerPage();
            String bindingCost = "";
            int totalPages = snapshot.data ?? 0;
            double totalCost = _calculateTotalCost(totalPages);

            if (widget.selectedBinding == "Soft Binding") {
              bindingCost = "Binding Cost: ${widget.softBinding}";
            } else if (widget.selectedBinding == "Spiral Binding") {
              bindingCost = "Binding Cost: ${widget.hardBinding}";
            } else {
              bindingCost = "Binding Cost: 0";
            }

            return AlertDialog(
              title: Text(
                widget.title,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (widget.isEmergency)
                      Text(
                        "Emergency Print Out",
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          backgroundColor: Colors.red.shade100,
                        ),
                      ),
                    Text(widget.paperSize),
                    Text("Print Format: ${widget.printFormat}"),
                    Text("Print Color: ${widget.printColor}"),
                    Text(
                      "Binding: ${widget.selectedBinding ?? 'None'} (${widget.selectedCoverColor ?? 'No Cover'})",
                    ),
                    Text(widget.emergencyPrint),
                    Text("Orientation: ${widget.orientation}"),
                    Text("Customization: ${widget.customMessage}"),
                    const SizedBox(height: 10),
                    Text(
                      "Selected File: ${widget.file.path.split('/').last}",
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.blue,
                      ),
                    ),
                    const SizedBox(height: 5),
                    if (snapshot.connectionState == ConnectionState.waiting)
                      const Text(
                        "Reading pages...",
                        style: TextStyle(color: Colors.grey),
                      )
                    else if (snapshot.hasError || totalPages == 0)
                      const Text(
                        "Could not read page count \n file may be password protected",
                        style: TextStyle(color: Colors.red),
                      )
                    else
                      ExpansionTile(
                        title: const Text(
                          "Price Summary",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        trailing: Icon(
                          _isExpanded
                              ? Icons.keyboard_arrow_up
                              : Icons.keyboard_arrow_down,
                        ),
                        onExpansionChanged: (expanded) {
                          print("ExpansionTile tapped, expanded: $expanded");
                          setState(() {
                            _isExpanded = expanded;
                          });
                        },
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "Total Pages: $totalPages",
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.grey[800],
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text("Price Per Page: $pricePerPage"),
                                Text(
                                    "Number of Copies: ${widget.numberOfCopies}"),
                                if (widget.selectedBinding != null &&
                                    widget.selectedBinding!.isNotEmpty)
                                  Text(bindingCost),
                                if (widget.extraColorPageCount > 0)
                                  Text(
                                      "Extra Color Pages Cost: ${widget.extraColorPageCount * (widget.selectedPaperSize == "A4" ? (widget.selectedPrintFormat == "Single-Sided" ? widget.a4SingColor : widget.a4DoubColor) : (widget.selectedPrintFormat == "Single-Sided" ? widget.a3SingColor : widget.a3DoubColor))}"),
                                if (widget.isEmergency)
                                  Text(
                                      "Emergency Print Cost: ${widget.emergencyPr}"),
                                if (widget.commision != 0)
                                  Text("Convenience Fee: ${widget.commision}"),
                              ],
                            ),
                          ),
                        ],
                      ),
                    Text(
                      "Total Amount: ₹$totalCost",
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.blue,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ElevatedButton(
                      onPressed: () async {
                        print("Preview File button pressed");
                        try {
                          await OpenFile.open(finalfile.path);
                        } catch (e) {
                          print("Error opening file: $e");
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Error opening file: $e')),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text("Preview File"),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    print("Cancel button pressed");
                    Navigator.of(context).pop();
                  },
                  child: const Text(
                    "Cancel",
                    style: TextStyle(color: Colors.red),
                  ),
                ),
                ElevatedButton(
                  onPressed: _isConfirmLoading || snapshot.connectionState == ConnectionState.waiting || snapshot.hasError || totalPages == 0
                      ? null
                      : () async {
                    print("Confirm button pressed. Opening Razorpay...");
                    _openRazorpayCheckout(totalCost);
                    // _placeOrderAfterPaymentSuccess(totalCost, totalPages, finalfile);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text("Confirm Order"),
                ),
              ],
            );
          },
        ),
        if (_isConfirmLoading)
          Container(
            color: Colors.black54,
            width: double.infinity,
            height: double.infinity,
            child: const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
          ),
      ],
    );
  }

  double _calculatePricePerPage() {
    double pricePerPage = 0;
    if (widget.selectedPaperSize == "A4") {
      if (widget.selectedPrintFormat == "Single-Sided") {
        pricePerPage += (widget.selectedPrintColor == "Black & White")
            ? widget.a4SingBlaWh
            : widget.a4SingColor;
      } else {
        pricePerPage += (widget.selectedPrintColor == "Black & White")
            ? widget.a4DoubBlaWh
            : widget.a4DoubColor;
      }
    } else {
      if (widget.selectedPrintFormat == "Single-Sided") {
        pricePerPage += (widget.selectedPrintColor == "Black & White")
            ? widget.a3SingBlaWh
            : widget.a3SingColor;
      } else {
        pricePerPage += (widget.selectedPrintColor == "Black & White")
            ? widget.a3DoubBlaWh
            : widget.a3DoubColor;
      }
    }
    return pricePerPage;
  }

  Future<void> _placeOrderAfterPaymentSuccess(double totalCost, int totalPages, File finalFile) async {
    try {
      setState(() {
        _isConfirmLoading = true;
      });

      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        print("Null user detected");
        setState(() {
          _isConfirmLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please login to place order')),
        );
        return;
      }

      final storageRef = FirebaseStorage.instance.ref().child(
          'orders/${DateTime.now().millisecondsSinceEpoch}.pdf');
      await storageRef.putFile(finalFile);
      final fileUrl = await storageRef.getDownloadURL();

      String username = "User";
      final userDoc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        username = userDoc.data()?['username'] ?? "User";
      }

      final orderData = {
        'userId': user.uid,
        'shopId': widget.shopId,
        'shopName': widget.shopName,
        'userName': username,
        'fileName': widget.file.path.split('/').last,
        'fileUrl': fileUrl,
        'totalPages': totalPages,
        'totalCost': totalCost,
        'status': 'pending',
        'timestamp': FieldValue.serverTimestamp(),
        'emergency': widget.isEmergency,
        'printSettings': {
          'paperSize': widget.selectedPaperSize,
          'printFormat': widget.printFormat,
          'printColor': widget.printColor,
          'orientation': widget.orientation,
          'binding': widget.selectedBinding,
          'copies': widget.numberOfCopies,
          'customMessage': widget.customMessage,
          'vinylColor': widget.selectedCoverColor,
          'extraColorPages': widget.extraColorPageCount,
        },
        'pricingDetails': {
          'basePricePerPage': _calculatePricePerPage(),
          'bindingCost': widget.selectedBinding == "Soft Binding"
              ? widget.softBinding
              : widget.selectedBinding == "Spiral Binding"
              ? widget.hardBinding
              : 0,
          'emergencyCost': widget.isEmergency ? widget.emergencyPr : 0,
          'commission': widget.commision,
        },
      };

      await FirebaseFirestore.instance.collection('orders').add(orderData);

      await Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => const OrdersScreen(fromUploadScreen: true),
        ),
      );
    } catch (e) {
      print("Error occurred: $e");
      setState(() {
        _isConfirmLoading = false;
      });
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error placing order: $e')),
      );
    }
  }

  Future<int> getPdfPageCount(File file) async {
    try {
      List<int> bytes = await file.readAsBytes();
      PdfDocument document = PdfDocument(inputBytes: bytes);
      int pageCount = document.pages.count;
      document.dispose();
      return pageCount;
    } catch (e) {
      print("Error reading PDF: $e");
      return 0;
    }
  }

  Future<File> processPdf(File file, String orientation) async {
    File finalFile = file;
    if (orientation == "Horizontal") {
      finalFile = await rotateAndSavePdf(file.path, true);
    } else {
      finalFile = await rotateAndSavePdf(file.path, false);
    }
    return finalFile;
  }

  Future<File> rotateAndSavePdf(String filePath, bool isHorizontal) async {
    File file = File(filePath);
    List<int> bytes = await file.readAsBytes();
    PdfDocument document = PdfDocument(inputBytes: bytes);
    PdfPageRotateAngle rotationAngle = isHorizontal
        ? PdfPageRotateAngle.rotateAngle90
        : PdfPageRotateAngle.rotateAngle0;
    for (int i = 0; i < document.pages.count; i++) {
      document.pages[i].rotation = rotationAngle;
    }
    Directory directory = await getApplicationDocumentsDirectory();
    String newPath = '${directory.path}/modified_document.pdf';
    File newFile = File(newPath);
    await newFile.writeAsBytes(await document.save());
    document.dispose();
    return newFile;
  }
}

void showCustomDialog({
  required BuildContext context,
  required String shopId,
  required String shopName,
  required String title,
  required String paperSize,
  required String PrintFormat,
  required String PrintColor,
  required String Binding,
  required String EmergencyPrint,
  required String Orientation,
  required File file,
  required bool isEmergency,
  required double A4SingBlaWh,
  required double A4SingColor,
  required double A4DoubBlaWh,
  required double A4DoubColor,
  required double A3SingBlaWh,
  required double A3SingColor,
  required double A3DoubBlaWh,
  required double A3DoubColor,
  required double SoftBinding,
  required double HardBinding,
  required double EmergencyPr,
  required String? selectedPaperSize,
  required String? selectedPrintFormat,
  required String? selectedPrintColor,
  required String? selectedBinding,
  required int NumberOfCopies,
  required int Commision,
  required String customMessage,
  required String? selectedCoverColor,
  required int extraColorPageCount,
})
{
  showDialog
    (
    context: context,
    barrierDismissible: false,
    builder: (BuildContext dialogContext) {
      return CustomDialog(
        shopId: shopId,
        shopName: shopName,
        title: title,
        paperSize: paperSize,
        printFormat: PrintFormat,
        printColor: PrintColor,
        binding: Binding,
        emergencyPrint: EmergencyPrint,
        orientation: Orientation,
        file: file,
        isEmergency: isEmergency,
        a4SingBlaWh: A4SingBlaWh,
        a4SingColor: A4SingColor,
        a4DoubBlaWh: A4DoubBlaWh,
        a4DoubColor: A4DoubColor,
        a3SingBlaWh: A3SingBlaWh,
        a3SingColor: A3SingColor,
        a3DoubBlaWh: A3DoubBlaWh,
        a3DoubColor: A3DoubColor,
        softBinding: SoftBinding,
        hardBinding: HardBinding,
        emergencyPr: EmergencyPr,
        selectedPaperSize: selectedPaperSize,
        selectedPrintFormat: selectedPrintFormat,
        selectedPrintColor: selectedPrintColor,
        selectedBinding: selectedBinding,
        numberOfCopies: NumberOfCopies,
        commision: Commision,
        customMessage: customMessage,
        selectedCoverColor: selectedCoverColor,
        extraColorPageCount: extraColorPageCount,
      );
    },
  );
}

Future<int> getPdfPageCount(File file) async {
  try {
    // Read the file as bytes
    List<int> bytes = await file.readAsBytes();

    // Load the PDF document
    PdfDocument document = PdfDocument(inputBytes: bytes);

    // Get the total number of pages
    int pageCount = document.pages.count;

    // Dispose the document to free memory
    document.dispose();

    return pageCount;
  } catch (e) {
    print("Error reading PDF: $e");
    return 0; // Return 0 if unable to read
  }
}

Future<File> rotateAndSavePdf(String filePath, bool isHorizontal) async {
  // Load the existing PDF document
  File file = File(filePath);
  List<int> bytes = await file.readAsBytes();
  PdfDocument document = PdfDocument(inputBytes: bytes);

  // Set rotation based on the selected orientation
  PdfPageRotateAngle rotationAngle = isHorizontal
      ? PdfPageRotateAngle.rotateAngle90 // Head to the right (Horizontal)
      : PdfPageRotateAngle.rotateAngle0; // Normal Vertical

  // Apply rotation to all pages
  for (int i = 0; i < document.pages.count; i++) {
    document.pages[i].rotation = rotationAngle;
  }

  // Get directory to save the modified PDF
  Directory directory = await getApplicationDocumentsDirectory();
  String newPath = '${directory.path}/modified_document.pdf';

  // Save the updated document
  File newFile = File(newPath);
  await newFile.writeAsBytes(await document.save());

  // Dispose the document
  document.dispose();

  return newFile; // ✅ Return the File object
}

Future<File> processPdf(File file, String orientation) async {
  File finalFile = file;

  if (orientation == "Horizontal") {
    finalFile = await rotateAndSavePdf(file.path, true);
  } else {
    finalFile = await rotateAndSavePdf(file.path, false);
  }

  return finalFile; // ✅ Return the processed PDF file
}

Future<String?> checkAndFetchLocation(BuildContext context) async {
  bool serviceEnabled = await Geolocator.isLocationServiceEnabled();

  if (!serviceEnabled) {
    // Show dialog to enable location services
    await showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text("Enable Location"),
          content: Text("Please enable location services to proceed."),
          actions: [
            TextButton(
              onPressed: () async {
                Navigator.pop(context);
                await Geolocator.openLocationSettings();
              },
              child: Text("Enable"),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
              },
              child: Text("Cancel"),
            ),
          ],
        );
      },
    );

    // Recheck location service after dialog is closed
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null; // If still off, return null
  }

  // Location services are enabled, check permissions
  LocationPermission permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) {
      return null; // Permission denied
    }
  }

  if (permission == LocationPermission.deniedForever) {
    return null; // Cannot request permissions
  }

  // Fetch the current location
  try {
    Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high);
    return "${position.latitude}, ${position.longitude}";
  } catch (e) {
    print("Error fetching location: $e");
    return null;
  }
}

class RecentOrdersWidget extends StatelessWidget {
  const RecentOrdersWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Recent Orders",
            style:
            GoogleFonts.poppins(fontSize: 17, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 10),
          StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('orders')
                .where('userId',
                isEqualTo: FirebaseAuth.instance.currentUser?.uid)
                .orderBy('timestamp', descending: true)
                .limit(2)
                .snapshots(),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const Text('Error loading orders');
              }

              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              final orders = snapshot.data!.docs;

              if (orders.isEmpty) {
                return const Text("No recent orders.");
              }

              return Column(
                children: orders.map((doc) {
                  final data = doc.data() as Map<String, dynamic>;
                  final status = data['status'] ?? 'pending';
                  Color statusColor = Colors.blue;
                  if (status == 'completed') statusColor = Colors.green;
                  if (status == 'pending') statusColor = Colors.orange;
                  if (status == 'cancelled') statusColor = Colors.red;

                  return GestureDetector(
                    onTap: () => _showOrderDetails(context, doc.id),
                    // Open dialog on tap
                    child: Card(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      child: ListTile(
                        title: Text(
                          data['shopName'] ?? 'Shop Name',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle:
                        Text('File: ${data['fileName'] ?? 'No file name'}'),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            status.toUpperCase(),
                            style: TextStyle(
                                color: statusColor,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  void _showOrderDetails(BuildContext context, String orderId) {
    showDialog(
      context: context,
      builder: (context) => OrderDetailsDialog(orderId: orderId),
    );
  }
}

String truncateWithEllipsis(int cutoff, String myString) {
  return (myString.length <= cutoff)
      ? myString
      : '${myString.substring(0, cutoff)}...';
}

// Utility function to handle post-sign-in logic
Future<void> _processAfterSignIn(BuildContext context,
    UserCredential userCredential, String? username) async {
  String uid = userCredential.user!.uid;
  DocumentSnapshot userDoc =
  await FirebaseFirestore.instance.collection('users').doc(uid).get();

  if (username != null) {
    // Registration
    if (!userDoc.exists) {
      // New user, save username
      await FirebaseFirestore.instance.collection('users').doc(uid).set({
        'username': username,
        'phoneNumber': userCredential.user!.phoneNumber,
        'createdAt': FieldValue.serverTimestamp(),
      });
      Navigator.pushReplacementNamed(context, '/home');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Phone number already registered')),
      );
    }
  } else {
    // Login
    if (userDoc.exists) {
      Navigator.pushReplacementNamed(context, '/home');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('User not found. Please register first.')),
      );
    }
  }
}
