import 'package:flutter/foundation.dart';

class SearchMatch {
  final int productId;
  final double distance;

  SearchMatch({required this.productId, required this.distance});

  factory SearchMatch.fromJson(Map<String, dynamic> json) {
    return SearchMatch(
      productId: json['productId'] as int,
      distance: (json['distance'] as num).toDouble(),
    );
  }
}
