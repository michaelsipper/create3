"use client";

import React, { useState } from "react";
import { Upload, X, Link as LinkIcon, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

interface EventLocation {
  name: string;
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface EventData {
  title: string;
  datetime: string;
  location: EventLocation;
  description?: string;
  capacity?: number;
  type?: "social" | "business" | "entertainment";
}

interface EditableEventData extends EventData {
  isEditing?: boolean;
}

const CreatePlanType3 = () => {
  const { toast } = useToast(); // Add this line near the top with other state declarations
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EditableEventData | null>(null);

  // Rest of your code stays the same...

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Process image with API
      const formData = new FormData();
      formData.append("image", file);

      console.log("Sending image to API...");
      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process image");
      }

      const data = await response.json();
      console.log("Received data:", data);
      setEventData(data);
      toast.success("Image processed successfully!");
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Failed to process image");
      toast.error("Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get("url") as string;

    if (!url) {
      setError("Please enter a URL");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Process URL with API
      const apiFormData = new FormData();
      apiFormData.append("url", url);

      const response = await fetch("/api/process", {
        method: "POST",
        body: apiFormData,
      });

      if (!response.ok) {
        throw new Error("Failed to process URL");
      }

      const data = await response.json();
      setEventData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process URL");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = () => {
    if (eventData) {
      setEventData({ ...eventData, isEditing: true });
    }
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (eventData) {
      setEventData({
        title: formData.get("title") as string,
        datetime: formData.get("datetime") as string,
        location: {
          name: formData.get("location") as string,
          address: (formData.get("address") as string) || undefined,
        },
        description: (formData.get("description") as string) || undefined,
        capacity: Number(formData.get("capacity")) || undefined,
        type: formData.get("type") as EventData["type"],
        isEditing: false,
      });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Create Event from Media</CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="image">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="image">Upload Image</TabsTrigger>
              <TabsTrigger value="url">Enter URL</TabsTrigger>
            </TabsList>

            <TabsContent value="image">
              <div className="flex flex-col items-center gap-4">
                <label className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="mt-2 text-sm text-gray-500">
                    Upload event image or flyer
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </label>

                {preview && (
                  <div className="relative w-full">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-48 object-contain rounded-lg"
                    />
                    <button
                      onClick={() => {
                        setPreview(null);
                        setEventData(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-white rounded-full shadow"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="url">
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    name="url"
                    type="url"
                    placeholder="Paste event URL (Eventbrite, Facebook Events, etc.)"
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isProcessing}>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Process
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>

          {eventData && (
            <div className="mt-4 p-4 border rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Event Details</h3>
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  Edit Details
                </Button>
              </div>

              {eventData.isEditing ? (
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      name="title"
                      defaultValue={eventData.title}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Date & Time</label>
                    <Input
                      name="datetime"
                      type="datetime-local"
                      defaultValue={
                        eventData.datetime
                          ? new Date(eventData.datetime)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Location Name</label>
                    <Input
                      name="location"
                      defaultValue={eventData.location.name}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Address</label>
                    <Input
                      name="address"
                      defaultValue={eventData.location.address}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Capacity (optional)
                    </label>
                    <Input
                      name="capacity"
                      type="number"
                      defaultValue={eventData.capacity}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      name="description"
                      defaultValue={eventData.description}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Event Type</label>
                    <select
                      name="type"
                      defaultValue={eventData.type}
                      className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                    >
                      <option value="social">Social</option>
                      <option value="business">Business</option>
                      <option value="entertainment">Entertainment</option>
                    </select>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setEventData({ ...eventData, isEditing: false })
                      }
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              ) : (
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Title</dt>
                    <dd>{eventData.title}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Date & Time
                    </dt>
                    <dd>{new Date(eventData.datetime).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Location
                    </dt>
                    <dd>{eventData.location.name}</dd>
                    {eventData.location.address && (
                      <dd className="text-sm text-gray-500">
                        {eventData.location.address}
                      </dd>
                    )}
                  </div>
                  {eventData.capacity && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Capacity
                      </dt>
                      <dd>{eventData.capacity} people</dd>
                    </div>
                  )}
                  {eventData.type && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Event Type
                      </dt>
                      <dd className="capitalize">{eventData.type}</dd>
                    </div>
                  )}
                  {eventData.description && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Description
                      </dt>
                      <dd className="text-sm">{eventData.description}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center mt-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Processing...</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              setPreview(null);
              setEventData(null);
              setError("");
            }}
          >
            Clear
          </Button>
          <Button disabled={!eventData || isProcessing || eventData.isEditing}>
            Create Event
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CreatePlanType3;
