import 'package:flutter/material.dart';
import 'dart:convert'; // Import for base64Decode

class StyleWithImage {
  final int styleId;
  final String imageData; // Base64 encoded image
  final String?
  styleName; // We might want to add this from your existing Style model

  StyleWithImage({
    required this.styleId,
    required this.imageData,
    this.styleName,
  });

  factory StyleWithImage.fromJson(Map<String, dynamic> json) {
    return StyleWithImage(
      styleId: json['styleId'] as int,
      imageData: json['imageData'] as String,
    );
  }

  // Convert base64 to Image widget for display
  Widget get imageWidget {
    return Image.memory(
      base64Decode(imageData),
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          color: Colors.grey[200],
          child: const Icon(
            Icons.image_not_supported_outlined,
            color: Colors.grey,
            size: 32,
          ),
        );
      },
    );
  }

  // Get image as Image widget with custom properties
  Widget imageWidgetCustom({
    BoxFit fit = BoxFit.cover,
    double? width,
    double? height,
  }) {
    return Image.memory(
      base64Decode(imageData),
      fit: fit,
      width: width,
      height: height,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          width: width,
          height: height,
          color: Colors.grey[200],
          child: const Icon(
            Icons.image_not_supported_outlined,
            color: Colors.grey,
            size: 32,
          ),
        );
      },
    );
  }
}
