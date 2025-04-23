import 'package:flutter/foundation.dart';

class BrandPerCatRet {
  final List<String> brands;

  BrandPerCatRet({required this.brands});

  factory BrandPerCatRet.fromJson(Map<String, dynamic> json) {
    List<String> safeBrands = [];

    if (json['brands'] != null && json['brands'] is List) {
      for (var brand in json['brands']) {
        if (brand is String) {
          safeBrands.add(brand);
        }
      }
    }

    debugPrint("✅ Safe Brands extracted (${safeBrands.length}): $safeBrands");

    return BrandPerCatRet(brands: safeBrands);
  }
}

class CategoryPerBraRet {
  final List<String> categories;

  CategoryPerBraRet({required this.categories});

  factory CategoryPerBraRet.fromJson(Map<String, dynamic> json) {
    List<String> safeCategories = [];

    if (json['categories'] != null && json['categories'] is List) {
      for (var category in json['categories']) {
        if (category is String) {
          safeCategories.add(category);
        }
      }
    }

    debugPrint(
      "✅ Safe Categories extracted (${safeCategories.length}): $safeCategories",
    );

    return CategoryPerBraRet(categories: safeCategories);
  }
}

class RetailerPerBraCat {
  final List<String> retailers;

  RetailerPerBraCat({required this.retailers});

  factory RetailerPerBraCat.fromJson(Map<String, dynamic> json) {
    List<String> safeRetailers = [];

    if (json['retailers'] != null && json['retailers'] is List) {
      for (var retailer in json['retailers']) {
        if (retailer is String) {
          safeRetailers.add(retailer);
        }
      }
    }

    debugPrint(
      "✅ Safe Retailers extracted (${safeRetailers.length}): $safeRetailers",
    );

    return RetailerPerBraCat(retailers: safeRetailers);
  }
}

class FilterDto {
  final List<String>? categories;
  final List<String>? brands;
  final List<String>? retailers;
  final int? minPrice;
  final int? maxPrice;

  FilterDto({
    required this.categories,
    required this.brands,
    required this.retailers,
    this.minPrice,
    this.maxPrice,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (brands != null) map['brands'] = brands;
    if (categories != null) map['categories'] = categories;
    if (retailers != null) map['retailers'] = retailers;
    if (minPrice != null) map['minPrice'] = minPrice;
    if (maxPrice != null) map['maxPrice'] = maxPrice;
    return map;
  }
}
