"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TrendingUp, CheckCircle, XCircle, HelpCircle } from "lucide-react"
import ModelSelector from "./model-selector"
import DataUploader from "./data-uploader"
import LoadingSpinner from "./loading-spinner"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

// API base URL configuration
const API_BASE_URL = "https://2e76-130-207-126-160.ngrok-free.app"

export default function Dashboard() {
  // State management
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [plotUrl, setPlotUrl] = useState<string | null>(null)
  const [apiMessage, setApiMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadedPath, setUploadedPath] = useState<string | null>(null)

  // Loading states
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [isFinetuning, setIsFinetuning] = useState<boolean>(false)
  const [isGeneratingPlot, setIsGeneratingPlot] = useState<boolean>(false)

  // Derived states
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false)
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false)
  const [exampleLoaded, setExampleLoaded] = useState<boolean>(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [finetuneOption, setFinetuneOption] = useState("yes")
  const [epochs, setEpochs] = useState(1)

  // Clear messages when starting a new action
  const clearMessages = () => {
    setApiMessage(null)
    setErrorMessage(null)
  }

  const resetDashboard = () => {
    clearMessages()
    setUploadedFile(null)      // clear the file selection
    setPlotUrl(null)           // hide any existing plot
    setIsModelLoaded(false)    // mark model as "not yet loaded"
    setIsDataLoaded(false)     // mark data as "not yet uploaded"
  }

  // Handle model selection
  const handleModelSelect = (model: string) => {
    resetDashboard()
    setSelectedModel(model)
  }

  // Handle file upload selection and trigger upload
  const handleDatasetUpload = async (file: File) => {
    setUploadedFile(file)
    clearMessages()

    // Automatically trigger upload when file is selected
    await uploadDataset(file)
  }
  const pollTaskStatus = async (taskId: string, onSuccess: (result: any) => void, onError: (errMsg: string) => void, onProgress?: (state: string) => void) => {
    try {
      const response = await fetch(`https://flaskapi4samay-production.up.railway.app/task_status/${taskId}`);
      const data = await response.json();
  
      if (data.state === "PENDING" || data.state === "STARTED") {
        if (onProgress) onProgress(data.state);
        setTimeout(() => pollTaskStatus(taskId, onSuccess, onError, onProgress), 2000);
      } else if (data.state === "SUCCESS" && data.result) {
        onSuccess(data.result);
      } else {
        onError(data.result?.message || data.status || "Unknown error");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Error polling task status");
    }
  };

  // Helper to handle API responses that may be immediate or task-based
  const handleApiResponse = async (response: Response, onSuccess: (result: any) => void, onError: (errMsg: string) => void, pollTaskStatusFn?: (taskId: string, onSuccess: (result: any) => void, onError: (errMsg: string) => void, onProgress?: (state: string) => void) => void, onProgress?: (state: string) => void) => {
    const data = await response.json();
    if (!response.ok) {
      onError(data.message || `Error: ${response.status} ${response.statusText}`);
      return;
    }
    if (data.task_id && pollTaskStatusFn) {
      pollTaskStatusFn(data.task_id, onSuccess, onError, onProgress);
    } else if (data.result) {
      // Immediate result
      onSuccess(data.result);
    } else {
      // Some endpoints may return data directly (e.g., message, path, etc.)
      onSuccess(data);
    }
  };

  // Load model API call
  const loadModel = async () => {
    if (!selectedModel) {
      setErrorMessage("Please select a model first");
      return;
    }
    clearMessages();
    setIsLoadingModel(true);
    try {
      const response = await fetch(`https://flaskapi4samay-production.up.railway.app/load_model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: selectedModel }),
      });
      await handleApiResponse(
        response,
        (result) => {
          setApiMessage(result.message || "Model loaded successfully");
          setIsModelLoaded(true);
          setIsLoadingModel(false);
        },
        (errMsg) => {
          setErrorMessage(errMsg);
          setIsLoadingModel(false);
        },
        pollTaskStatus
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "An error occurred while loading the model");
      setIsLoadingModel(false);
    }
  };

  // Upload dataset API call
  const uploadDataset = async (file: File) => {
    if (!file) {
      setErrorMessage("Please select a CSV file to upload");
      return;
    }
    clearMessages();
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("dataset", file);
      const response = await fetch(`https://flaskapi4samay-production.up.railway.app/upload_dataset`, {
        method: "POST",
        body: formData,
      });
      await handleApiResponse(
        response,
        (result) => {
          setUploadedPath(result.path || null);
          setApiMessage(result.message || "Dataset uploaded successfully");
          setIsDataLoaded(true);
          setIsUploading(false);
        },
        (errMsg) => {
          setErrorMessage(errMsg);
          setIsUploading(false);
        },
        pollTaskStatus
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "An error occurred while uploading the dataset");
      setIsUploading(false);
    }
  };

  // Finetune model API call
  const finetune = async () => {
    if (!isModelLoaded) {
      setErrorMessage("Please load a model first");
      return;
    }
    if (!isDataLoaded) {
      setErrorMessage("Please upload a dataset first");
      return;
    }
    clearMessages();
    setIsFinetuning(true);
    try {
      const response = await fetch(`https://flaskapi4samay-production.up.railway.app/finetune`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: selectedModel, dataset_name: "uploaded" }),
      });
      await handleApiResponse(
        response,
        (result) => {
          setApiMessage(result.message || "Model fine-tuned successfully");
          setIsFinetuning(false);
        },
        (errMsg) => {
          setErrorMessage(errMsg);
          setIsFinetuning(false);
        },
        pollTaskStatus
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "An error occurred while finetuning the model");
      setIsFinetuning(false);
    }
  };

  // Generate plot API call
  const generatePlot = async (finetuneOption = "no", epochs = 10) => {
    if (!isModelLoaded) {
      setErrorMessage("Please load a model first");
      return;
    }
    if (!isDataLoaded) {
      setErrorMessage("Please upload a dataset first");
      return;
    }
    if (!uploadedPath) {
      setErrorMessage("No dataset path available. Please re-upload your dataset.");
      return;
    }
    clearMessages();
    setPlotUrl(null);
    setIsGeneratingPlot(true);
    try {
      const response = await fetch(`https://flaskapi4samay-production.up.railway.app/run_inference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_name: selectedModel,
          dataset_name: "uploaded",
          path: uploadedPath,
          finetune: finetuneOption === "yes",
          epochs: epochs,
        }),
      });
      await handleApiResponse(
        response,
        (result) => {
          if (result.result_path) {
            setPlotUrl(`https://flaskapi4samay-production.up.railway.app${result.result_path}`);
            setApiMessage("Plot generated successfully");
          } else {
            setErrorMessage(result.message || "Failed to generate plot");
          }
          setIsGeneratingPlot(false);
        },
        (errMsg) => {
          setErrorMessage(errMsg);
          setIsGeneratingPlot(false);
        },
        pollTaskStatus
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "An error occurred while generating the plot");
      setIsGeneratingPlot(false);
    }
  };

  // Handle using example file
  const handleUseExample = () => {
    setExampleLoaded(true);
    setIsDataLoaded(true);
    setUploadedFile(null);
    setApiMessage('Example file loaded');
    setUploadedPath('data/data/ETTh1.csv');
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (plotUrl) {
        URL.revokeObjectURL(plotUrl)
      }
    }
  }, [plotUrl])

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          <Card className="w-full md:w-1/2 transition-opacity duration-500 ease-in-out">
            <CardHeader>
              <CardTitle>Model Selection</CardTitle>
              <CardDescription>Choose a time-series forecasting model</CardDescription>
            </CardHeader>
            <CardContent>
              <ModelSelector onSelect={handleModelSelect} selectedModel={selectedModel} />
            </CardContent>
            <CardFooter>
              <Button onClick={loadModel} disabled={!selectedModel || isLoadingModel} className="w-full">
                {isLoadingModel ? <LoadingSpinner className="mr-2" /> : null}
                {isLoadingModel ? "Loading Model..." : "Load Model"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="w-full md:w-1/2">
            <CardHeader>
              <CardTitle>Dataset Upload</CardTitle>
              <CardDescription>Upload your time-series CSV data</CardDescription>
            </CardHeader>
            <CardContent>
              {exampleLoaded ? (
                <div className="flex flex-col items-center justify-center h-32 text-green-600 font-semibold">
                  Example file loaded
                </div>
              ) : (
                <DataUploader key={selectedModel} onUpload={handleDatasetUpload} isUploading={isUploading} />
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                onClick={handleUseExample}
                disabled={!isModelLoaded}
                variant="outline"
                className="w-1/3 mr-2"
              >
                Use Example
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    disabled={!isModelLoaded || !isDataLoaded || isGeneratingPlot}
                    className="w-full"
                  >
                    {isGeneratingPlot ? <LoadingSpinner className="mr-2" /> : null}
                    {isGeneratingPlot ? "Generating Plot..." : "Generate Plot"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate Plot Options</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-1 flex items-center gap-1">
                        Finetuning
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-pointer align-middle">
                              <HelpCircle className="w-4 h-4 text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span style={{ maxWidth: 240, whiteSpace: 'normal', display: 'block' }}>
                              If enabled, the model will be finetuned on uploaded dataset before generating a forecast. 
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </label>
                      <Select value={finetuneOption} onValueChange={setFinetuneOption}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Finetune</SelectItem>
                          <SelectItem value="no">No Finetune</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {finetuneOption === "yes" && (
                      <div>
                        <label className="block mb-1 flex items-center gap-1">
                          Epochs
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-pointer align-middle">
                                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span style={{ maxWidth: 240, whiteSpace: 'normal', display: 'block' }}>
                                This value is essentially the number of times the model will iterate over the data during finetuning. Note that a higher value will improve the accuracy of the model but will also take longer to generate a forecast.
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          step={1}
                          value={epochs}
                          onChange={e => {
                            let val = Math.max(1, Math.min(10, Math.round(Number(e.target.value))));
                            setEpochs(val);
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setDialogOpen(false);
                        generatePlot(finetuneOption, epochs);
                      }}
                    >
                      Generate
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        </div>

        {/* Status messages */}
        {apiMessage && (
          <Alert variant="default" className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{apiMessage}</AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Plot Display */}
        {plotUrl ? (
          <Card className="transition-opacity duration-500 ease-in-out">
            <CardHeader>
              <CardTitle>Forecast Results</CardTitle>
              <CardDescription>Time-series forecast visualization</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              <img
                src={plotUrl || "/placeholder.svg"}
                alt="Forecast Plot"
                className="max-w-full border rounded-md shadow-sm"
              />
              <Button
                asChild
                variant="outline"
                className="mt-4"
              >
                <a href={plotUrl} download="forecast.png">
                  Download Image
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="transition-opacity duration-500 ease-in-out">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-muted rounded-full p-3">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-lg">Ready for Forecasting</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Select a model and upload your dataset, then generate a forecast plot to visualize the results.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Button variant="outline" size="sm" disabled={!selectedModel} onClick={loadModel}>
                    {selectedModel ? "Load Selected Model" : "Select a Model First"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  )
}
