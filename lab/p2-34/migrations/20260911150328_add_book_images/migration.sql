-- CreateTable
CREATE TABLE "book_images" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "img_order" INTEGER NOT NULL,

    CONSTRAINT "book_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "book_images" ADD CONSTRAINT "book_images_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
