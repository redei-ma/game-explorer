using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LibraryService.Migrations
{
    /// <inheritdoc />
    public partial class AddParentPlatformsToWishlist : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ParentPlatformsJson",
                table: "WishlistItems",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ParentPlatformsJson",
                table: "WishlistItems");
        }
    }
}
