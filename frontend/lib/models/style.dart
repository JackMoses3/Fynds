class Style {
  final int id;
  final String name;
  final String? description;

  Style({required this.id, required this.name, this.description});

  factory Style.fromJson(Map<String, dynamic> json) {
    return Style(
      id: json['id'],
      name: json['name'],
      description: json['description'],
    );
  }
}
