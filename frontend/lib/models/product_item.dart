class ProductItem {
  final int id;
  final String name;
  final String brand;
  final String retailer;
  final double price;
  final List<String> images;

  ProductItem({
    required this.id,
    required this.name,
    required this.brand,
    required this.retailer,
    required this.price,
    required this.images,
  });

  factory ProductItem.fromJson(Map<String, dynamic> json) {
    List<dynamic>? imageList = json['productImages'];
    List<String> safeImages = [];

    if (imageList != null) {
      for (var img in imageList) {
        final url = img['imageUrl'];
        if (url != null && url is String && url.isNotEmpty) {
          safeImages.add(url);
        }
      }
    }

    return ProductItem(
      id: json['id'],
      name: json['name'],
      brand: json['brand'] ?? '',
      retailer: json['retailer'],
      price: (json['price'] ?? 0).toDouble(),
      images: safeImages,
    );
  }
}
