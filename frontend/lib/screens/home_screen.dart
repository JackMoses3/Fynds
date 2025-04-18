import 'dart:convert';
import 'package:flutter/material.dart';
import 'preferences_screen.dart';
import 'package:http/http.dart' as http;
import '../models/product_item.dart';

class HomeScreen extends StatefulWidget {
  final Map<String, dynamic>? initialFilters; // Define the optional filters
  const HomeScreen({super.key, this.initialFilters}); // Single constructor
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  final List<ProductItem> _productHistory = [];
  int _currentProductIndex = -1; //-1 as initially no product is selected
  bool _isFetching =
      false; //ensures a new product fetch doesn't occur while one is occuring
  Map<String, dynamic>? filters;

  ProductItem? get product =>
      (_currentProductIndex >= 0 &&
              _currentProductIndex < _productHistory.length)
          ? _productHistory[_currentProductIndex] //gets the current product
          : null;

  bool isLiked = false;
  bool isSaved = false;
  bool isInBasket = false;
  int _currentImageIndex = 0; //tracks which image of product is being displayed
  late final PageController
  _pageController; // used for image carousel (left and white swipping)
  final PageController _verticalController =
      PageController(); //controls up down scrolling

  late final AnimationController _basketController;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();

    // Initialize animation controller for the shopping bag button
    _basketController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );

    // Scale animation when the basket button is pressed
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(
        parent: _basketController,
        curve: Curves.easeOut,
        reverseCurve: Curves.easeIn,
      ),
    );

    filters =
        widget
            .initialFilters; //Filters are passed from the parent widget (preferences screen).
    //NOTE: receiving correct preferences but not able to put onto home page yet, some error occurs.

    fetchAndAddProduct().then(
      (_) => fetchAndAddProduct(),
    ); //Fetch a product on start
  }

  //fetcha and adds a new product to the history
  Future<void> fetchAndAddProduct() async {
    if (_isFetching) return;
    _isFetching = true;

    http.Response? response;

    try {
      if (filters != null && filters!.isNotEmpty) {
        //if filters are set, requests filtered products from API. request works successfully, however not loading onto home page
        response = await http.post(
          Uri.parse(
            'http://10.0.2.2:3000/api/product-item/random-with-filters',
          ),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'brand': filters!['brands'],
            'retailer': filters!['retailers'],
            'category': filters!['categories'],
            'minPrice': filters!['minPrice'],
            'maxPrice': filters!['maxPrice'],
          }),
        );
      } else {
        // If no filters, fetch a random product
        response = await http.get(
          Uri.parse('http://10.0.2.2:3000/api/product-item/random'),
        );
      }

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        final newProduct = ProductItem.fromJson(json);

        //if product doesn't have any images, skip
        if (newProduct.images.isEmpty) {
          debugPrint("⚠️ Product has no images. Skipping.");
          return;
        }

        setState(() {
          _productHistory.add(newProduct); // Add the new product to history
          if (_currentProductIndex == -1) {
            _currentProductIndex =
                0; // If no product selected, set the first one
            _resetState();
          }
        });

        debugPrint("✅ First image URL: ${newProduct.images.first}");
        debugPrint("✅ First product: ${response.body}");
      } else {
        debugPrint('❌ Failed to load product: ${response.body}');
      }
    } catch (e, stack) {
      debugPrint('❌ Error fetching product: $e');
      if (response != null) {
        debugPrint('📦 Response body: ${response.body}');
      }
      debugPrint('🪵 Stacktrace: $stack');
    } finally {
      _isFetching = false;
    }
  }

  void _resetState() {
    // Resets the UI and state whenever a new product is displayed
    isLiked = false;
    isSaved = false;
    isInBasket = false;
    _currentImageIndex = 0;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pageController.hasClients &&
          product != null &&
          product!.images.isNotEmpty) {
        _pageController.jumpToPage(
          0,
        ); // Reset the image carousel to the first image
      }
    });
  }

  void toggleBasket() {
    setState(() {
      isInBasket = !isInBasket;
    });

    _basketController.forward().then(
      (_) => _basketController.reverse(),
    ); // Animate basket button press

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(isInBasket ? 'Added to basket' : 'Removed from basket'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  List<Widget> buildDots(int count, int activeIndex) {
    int totalDots = count > 5 ? 5 : count;
    int startIndex = 0;

    //adjusts the current dot for the active image
    if (count > 5) {
      if (activeIndex <= 2) {
        startIndex = 0;
      } else if (activeIndex >= count - 3) {
        startIndex = count - 5;
      } else {
        startIndex = activeIndex - 2;
      }
    }

    return List<Widget>.generate(totalDots, (index) {
      final isActive = startIndex + index == activeIndex;
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.black.withOpacity(0.6),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white),
        ),
      );
    });
  }

  @override
  void dispose() {
    _basketController.dispose();
    _pageController.dispose();
    _verticalController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body:
          product == null
              ? const Center(child: CircularProgressIndicator())
              : PageView.builder(
                scrollDirection: Axis.vertical, //swipe up or down
                controller: _verticalController,
                itemCount: _productHistory.length,
                onPageChanged: (index) {
                  setState(() {
                    _currentProductIndex =
                        index; // Update the current product index
                    _resetState(); //reset UI for new product (like, save, basket)
                  });
                  if (index >= _productHistory.length - 2) {
                    fetchAndAddProduct();
                  }
                },
                itemBuilder: (context, verticalIndex) {
                  final current = _productHistory[verticalIndex];
                  return Stack(
                    children: [
                      PageView.builder(
                        controller: _pageController,
                        itemCount: current.images.length,
                        onPageChanged: (index) {
                          setState(() {
                            _currentImageIndex = index;
                          });
                        },
                        itemBuilder: (context, index) {
                          return Image.network(
                            current.images[index],
                            fit: BoxFit.cover,
                            headers: {
                              "User-Agent":
                                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                            },
                            errorBuilder:
                                (context, error, stackTrace) => const Center(
                                  child: Text('❌ Failed to load image'),
                                ),
                          );
                        },
                      ),
                      Align(
                        alignment: Alignment.bottomCenter,
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 130),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: buildDots(
                              current.images.length,
                              _currentImageIndex,
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 40,
                        left: 20,
                        child: IconButton(
                          icon: const Icon(
                            Icons.filter_alt,
                            color: Colors.white,
                          ),
                          iconSize: 30,
                          onPressed: () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder:
                                    (context) => PreferenceScreen(
                                      initialFilters: filters,
                                    ),
                              ),
                            );
                            if (result is Map<String, dynamic>) {
                              setState(() {
                                filters = result;
                                _productHistory.clear();
                                _currentProductIndex = -1;
                              });
                              fetchAndAddProduct();
                            }
                          },
                        ),
                      ),
                      Positioned(
                        bottom: 20,
                        left: 20,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color.fromRGBO(0, 0, 0, 153),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                current.retailer,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                current.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                current.brand,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                '\$${current.price.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Positioned(
                        right: 12,
                        bottom: MediaQuery.of(context).size.height * 0.25,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.favorite),
                              iconSize: 36,
                              color: isLiked ? Colors.red : Colors.white,
                              onPressed: () {
                                setState(() {
                                  isLiked = !isLiked;
                                });
                                debugPrint(isLiked ? '❤️ Liked' : '💔 Unliked');
                              },
                            ),
                            const SizedBox(height: 24),
                            IconButton(
                              icon: const Icon(Icons.bookmark),
                              iconSize: 36,
                              color: isSaved ? Colors.black : Colors.white,
                              onPressed: () {
                                setState(() {
                                  isSaved = !isSaved;
                                });
                                debugPrint(isSaved ? '🔖 Saved' : '❌ Unsaved');
                              },
                            ),
                            const SizedBox(height: 24),
                            AnimatedBuilder(
                              animation: _scaleAnimation,
                              builder: (context, child) {
                                return Transform.scale(
                                  scale: _scaleAnimation.value,
                                  child: IconButton(
                                    icon: const Icon(Icons.shopping_bag),
                                    iconSize: 36,
                                    color:
                                        isInBasket
                                            ? Colors.greenAccent
                                            : Colors.white,
                                    onPressed: toggleBasket,
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                },
              ),
    );
  }
}

//semi working. Filters cant be applied
