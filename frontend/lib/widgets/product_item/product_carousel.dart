// lib/screens/product_carousel_screen.dart
import 'package:flutter/material.dart';
import 'package:frontend/models/product_item/product_item.dart';
import 'package:frontend/widgets/product_item/product_item.dart';

class ProductCarouselScreen extends StatefulWidget {
  final List<ProductItem> products;
  final int initialIndex;

  const ProductCarouselScreen({
    Key? key,
    required this.products,
    this.initialIndex = 0,
  }) : super(key: key);

  @override
  _ProductCarouselScreenState createState() => _ProductCarouselScreenState();
}

class _ProductCarouselScreenState extends State<ProductCarouselScreen> {
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            scrollDirection: Axis.vertical,
            itemCount: widget.products.length,
            itemBuilder: (context, index) {
              return ProductItemWidget(
                key: ValueKey(widget.products[index].id),
                product: widget.products[index],
              );
            },
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 8,
            child: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
        ],
      ),
    );
  }
}
